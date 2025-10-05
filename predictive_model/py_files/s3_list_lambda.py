#!/usr/bin/env python3
"""
s3_list_lambda.py

Lambda handler + helper to list object keys from an S3 bucket.
Supports three credential sources:
  - ENV (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN)
  - Secrets Manager (secret name in event['secrets_manager_name'])
  - retrieve_credentials(event) OAuth flow (original approach)
"""

import base64
import json
import os

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError

REQUEST_TIMEOUT = (5, 15)  # (connect, read)


def retrieve_credentials(event):
    """
    Original OAuth-like flow to obtain temporary S3 credentials from an external provider.
    Note: this function expects event to contain:
      - s3_endpoint
      - edl_username
      - edl_password
    """
    session = requests.Session()
    resp = session.get(
        event["s3_endpoint"], allow_redirects=False, timeout=REQUEST_TIMEOUT
    )
    resp.raise_for_status()

    auth = f"{event['edl_username']}:{event['edl_password']}"
    encoded_auth = base64.b64encode(auth.encode("ascii")).decode("ascii")

    auth_redirect = session.post(
        resp.headers["location"],
        data={"credentials": encoded_auth},
        headers={"Origin": event["s3_endpoint"]},
        allow_redirects=False,
        timeout=REQUEST_TIMEOUT,
    )
    auth_redirect.raise_for_status()

    final = session.get(
        auth_redirect.headers["location"],
        allow_redirects=False,
        timeout=REQUEST_TIMEOUT,
    )
    final.raise_for_status()

    results = session.get(
        event["s3_endpoint"],
        cookies={"accessToken": final.cookies.get("accessToken")},
        timeout=REQUEST_TIMEOUT,
    )
    results.raise_for_status()
    return results.json()


def get_creds_from_secretsmanager(secret_name, region_name=None):
    """
    Reads AWS credentials (accessKeyId, secretAccessKey, sessionToken) from AWS Secrets Manager.
    The secret value must be a JSON string like:
    {"accessKeyId": "...", "secretAccessKey": "...", "sessionToken": "...", "expiration": "..."}
    """
    try:
        session = boto3.session.Session(region_name=region_name)
        client = session.client("secretsmanager")
        resp = client.get_secret_value(SecretId=secret_name)
        secret_string = resp.get("SecretString")
        if not secret_string:
            raise ValueError("Secret has no SecretString")
        return json.loads(secret_string)
    except ClientError as e:
        raise RuntimeError(f"Failed to read secret {secret_name}: {e}")


def build_s3_client_from_creds(creds, region_name=None):
    """
    Create a boto3 S3 client from credentials dict.
    creds must contain: accessKeyId, secretAccessKey, sessionToken
    """
    session = boto3.session.Session(
        aws_access_key_id=creds.get("accessKeyId")
        or creds.get("AccessKeyId")
        or os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=creds.get("secretAccessKey")
        or creds.get("SecretAccessKey")
        or os.environ.get("AWS_SECRET_ACCESS_KEY"),
        aws_session_token=creds.get("sessionToken")
        or creds.get("SessionToken")
        or os.environ.get("AWS_SESSION_TOKEN"),
        region_name=region_name,
    )
    return session.client(
        "s3", config=Config(retries={"max_attempts": 3, "mode": "standard"})
    )


def list_bucket_keys(s3_client, bucket, prefix=""):
    paginator = s3_client.get_paginator("list_objects_v2")
    page_iter = paginator.paginate(Bucket=bucket, Prefix=prefix)
    keys = []
    for page in page_iter:
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


def lambda_handler(event, context):
    """
    event: dict with one of the following credential options:
      1) Use ENV vars (no credential fields in event). Provide bucket_name.
      2) Provide event['secrets_manager_name'] to read creds from AWS Secrets Manager.
      3) Provide the OAuth info for retrieve_credentials: s3_endpoint, edl_username, edl_password.
    Required: event['bucket_name']
    Optional: event['prefix'], event['region_name']
    """
    bucket = event.get("bucket_name")
    if not bucket:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "bucket_name is required in event"}),
        }

    # Use Secrets Manager if secret name provided
    region_name = event.get("region_name", None)
    try:
        if event.get("secrets_manager_name"):
            secret_name = event["secrets_manager_name"]
            creds = get_creds_from_secretsmanager(secret_name, region_name=region_name)
            s3_client = build_s3_client_from_creds(creds, region_name=region_name)

        # Else, use ENV vars if AWS_ACCESS_KEY_ID present
        elif os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get(
            "AWS_SECRET_ACCESS_KEY"
        ):
            # If session token present, boto3 will use it automatically from env.
            s3_client = boto3.client(
                "s3",
                region_name=region_name,
                config=Config(retries={"max_attempts": 3, "mode": "standard"}),
            )

        # Else, fallback to the original retrieve_credentials flow (external OAuth)
        elif all(k in event for k in ("s3_endpoint", "edl_username", "edl_password")):
            creds = retrieve_credentials(event)
            s3_client = build_s3_client_from_creds(creds, region_name=region_name)

        else:
            return {
                "statusCode": 400,
                "body": json.dumps(
                    {
                        "error": "No valid credentials provided. Use ENV, secrets_manager_name, or provide s3_endpoint+edl_username+edl_password."
                    }
                ),
            }

        prefix = event.get("prefix", "")
        keys = list_bucket_keys(s3_client, bucket, prefix=prefix)

        return {"statusCode": 200, "body": json.dumps(keys)}

    except Exception as exc:
        # In Lambda, these should be logged to CloudWatch (print/raise will appear as logs)
        print("Error:", exc)
        return {"statusCode": 500, "body": json.dumps({"error": str(exc)})}


# Local test harness
if __name__ == "__main__":
    import pathlib
    import sys

    here = pathlib.Path(__file__).parent
    # default event file name
    event_file = here / "event.json"
    if len(sys.argv) > 1:
        event_file = pathlib.Path(sys.argv[1])
    with open(event_file, "r") as f:
        evt = json.load(f)
    print(lambda_handler(evt, None))
