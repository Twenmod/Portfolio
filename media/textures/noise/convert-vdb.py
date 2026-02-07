import openvdb
import numpy as np

input_file = "jt.vdb"   # or .geo if it contains VDB
output_file = "cloudnoise_like.raw"

# Read VDB file
grids = openvdb.read(input_file)

# Get density grid
grid = grids["density"]  # name from your metadata

# Convert to dense numpy array
# Returns array and bounding box
array, bbox = grid.copyToArray()

# array shape = (Z, Y, X)
print("Array shape (Z,Y,X):", array.shape)

# Convert to float32
array = array.astype(np.float32)

# Optional: normalize to 0..1 like your cloudnoise
minv = array.min()
maxv = array.max()
array = (array - minv) / (maxv - minv + 1e-6)

# Write RAW (no header, float32)
array.tofile(output_file)

print("Saved:", output_file)
print("Expected bytes:", array.size * 4)
print("Width Height Depth:", array.shape[2], array.shape[1], array.shape[0])
