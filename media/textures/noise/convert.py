import numpy as np
from PIL import Image

input_pattern = "NubisVoxelCloudNoise.{:03d}.tga"
num_slices = 128
output_file = "volume_green_float.raw"

slices = []

for i in range(1, num_slices + 1):
    filename = input_pattern.format(i)
    print("Loading:", filename)

    img = Image.open(filename).convert("RGBA")
    arr = np.array(img, dtype=np.uint8)

    # Extract green channel (0=R,1=G,2=B,3=A)
    green_u8 = arr[:, :, 1]

    # Convert to float32 in range 0..1
    green_f32 = green_u8.astype(np.float32) / 255.0

    slices.append(green_f32)

# Stack as (depth, height, width)
volume = np.stack(slices, axis=0)

# Write RAW float32 (no header)
volume.astype(np.float32).tofile(output_file)

print("Done!")
print("Volume shape:", volume.shape)
print("Expected bytes:", volume.size * 4)
