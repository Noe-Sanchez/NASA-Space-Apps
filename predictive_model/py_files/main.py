import earthaccess as ea

ea.login()  # opens browser or uses .netrc

# Search: PACE OCI Level-2 chlorophyll (example filter by time/area)
results = ea.search_data(
    short_name="PACE_OCI_L2_BGC",  # example product family name
    temporal=("2025-08-01", "2025-08-10"),
    bounding_box=(
        -98,
        16,
        -86,
        26,
    ),  # lon_min, lat_min, lon_max, lat_max (Gulf of MX example)
)

# Download locally (HTTPS)
files = ea.download(results, "./pace_data")
print(files)
