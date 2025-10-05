import sys
import logging
from urllib.parse import quote_plus
from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

config_logger = logging.getLogger("config_loader")
config_logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
stream_handler = logging.StreamHandler()
stream_handler.setFormatter(formatter)
if not config_logger.handlers:
    config_logger.addHandler(stream_handler)


# --- Main Settings Class Definition ---
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_NAME: str

    @property
    def database_url(self) -> str:
        """
        Assembles the database URL, correctly URL-encoding the password.
        """
        # URL-encode the password to handle special characters
        encoded_password = quote_plus(self.DB_PASSWORD)

        # Assemble the full URL for SQLAlchemy
        return f"mongodb+srv://{self.DB_USER}:{encoded_password}@{self.DB_HOST}/?retryWrites=true&w=majority&appName={self.DB_NAME}"


def get_settings() -> Settings:
    """
    Tries to create the main Settings object. If it fails due to missing
    core variables, it logs a fatal error and exits the application.
    """
    try:
        return Settings()
    except ValidationError as e:
        missing_vars = [err['loc'][0].upper() for err in e.errors() if err['type'] == 'missing']

        config_logger.critical(
            f"🚨 START CANCELED: Missing environment variables: {', '.join(missing_vars)}")

        sys.exit(1)

# Cached settings instance
settings = get_settings()
