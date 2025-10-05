# inspect_all_pace_files.py
import os
import re

import matplotlib.pyplot as plt
import xarray as xr

DATA_DIR = "./pace_data"
OUT_DIR = "./plots"
os.makedirs(OUT_DIR, exist_ok=True)

# choose what to try to plot, in order of preference
VAR_CANDIDATES = [
    "CHL",
    "chlor_a",  # chlorophyll
    "Rrs_443",
    "Rrs_551",
    "Rrs_665",  # reflectance examples
    "Kd_490",
    "bbp_532",
    "aph_443",  # other common L2 BGC vars
]

nc_files = sorted([f for f in os.listdir(DATA_DIR) if f.endswith(".nc")])
if not nc_files:
    raise SystemExit(f"No .nc files in {DATA_DIR}")

print(f"Found {len(nc_files)} files")


def nice_time_from_name(fname: str) -> str:
    # e.g., PACE_OCI.20250803T193141.L2.OC_BGC.V3_1.nc -> 2025-08-03 19:31:41
    m = re.search(r"\.(\d{8}T\d{6})\.", fname)
    if not m:
        return fname
    t = m.group(1)
    return f"{t[0:4]}-{t[4:6]}-{t[6:8]} {t[9:11]}:{t[11:13]}:{t[13:15]}"


for i, fname in enumerate(nc_files, 1):
    path = os.path.join(DATA_DIR, fname)
    print(f"[{i}/{len(nc_files)}] Opening {fname}")

    # open the group where the science vars live
    ds = xr.open_dataset(path, group="geophysical_data", engine="netcdf4")

    # pick the first available candidate variable
    var = next((v for v in VAR_CANDIDATES if v in ds.data_vars), None)
    if var is None:
        print("  No candidate variable found; variables present:", list(ds.data_vars))
        continue

    da = ds[var]

    # simple guard: only plot 2D arrays (lat x lon)
    if da.ndim != 2:
        print(f"  {var} is {da.ndim}D; skipping plot.")
        continue

    # plot
    plt.figure()
    da.plot()  # default colormap; quicklook
    plt.title(f"{var} — {nice_time_from_name(fname)}")
    out_png = os.path.join(OUT_DIR, f"{os.path.splitext(fname)[0]}_{var}.png")
    plt.savefig(out_png, dpi=150, bbox_inches="tight")
    print(f"  Saved {out_png}")
    plt.close()

print("Done. PNGs are in:", OUT_DIR)
