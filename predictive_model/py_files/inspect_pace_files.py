import os

import matplotlib.pyplot as plt
import xarray as xr

data_dir = "./pace_data"
nc_files = [f for f in os.listdir(data_dir) if f.endswith(".nc")]

if not nc_files:
    raise SystemExit("No .nc files found")

path = os.path.join(data_dir, nc_files[0])
print("Opening:", path)

# Open the top-level to inspect attributes (optional)
root = xr.open_dataset(path, engine="netcdf4")
print("\nTop-level attrs keys:", list(root.attrs.keys()))

# Open the geophysical variables group
ds = xr.open_dataset(path, group="geophysical_data", engine="netcdf4")
print("\nVars in geophysical_data:", list(ds.data_vars)[:25])  # preview

# Try a few common variable names for OCI L2 OC/BGC
candidates = [
    "chlor_a",
    "CHL",  # chlorophyll
    "aot_869",
    "aot_550",  # aerosol optical thickness
    "aph_443",
    "bbp_532",
    "Kd_490",  # IOPs / optics
    "Rrs_443",
    "Rrs_551",
    "Rrs_665",  # reflectance (if present)
]

var = next((v for v in candidates if v in ds.data_vars), None)
if var:
    print(f"\nPlotting {var}")
    ds[var].plot()  # default colormap; quick look
    plt.title(var)
    plt.show()
else:
    print("\nNo candidate vars found. Here are all variables to choose from:")
    for v in ds.data_vars:
        print(" -", v)
