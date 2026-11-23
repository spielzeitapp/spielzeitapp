/** Process logos from the tournament provider's white-backed image exports. */
function cleanTournamentLogo(image, removeOuterWhiteBackground) {
  const { data, width, height } = image;
  if (!removeOuterWhiteBackground(image)) return image;

  const pixelCount = width * height;
  const queue = new Int32Array(pixelCount);
  const seen = new Uint8Array(pixelCount);

  // JPEG compression leaves near-white pixels just outside the cutout.
  // Only traverse matte-colored pixels reachable from the removed backdrop.
  let tail = 0;
  const addMatte = pixel => {
    if (seen[pixel]) return;
    const offset = pixel * 4;
    const min = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const max = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    if (data[offset + 3] === 0 || (min >= 205 && max - min <= 28)) {
      seen[pixel] = 1;
      queue[tail++] = pixel;
    }
  };
  for (let x = 0; x < width; x++) {
    addMatte(x);
    addMatte((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    addMatte(y * width);
    addMatte((y + 1) * width - 1);
  }
  for (let head = 0; head < tail; head++) {
    const pixel = queue[head];
    const x = pixel % width;
    if (x > 0) addMatte(pixel - 1);
    if (x < width - 1) addMatte(pixel + 1);
    if (pixel >= width) addMatte(pixel - width);
    if (pixel < pixelCount - width) addMatte(pixel + width);
  }
  // An almost entirely erased logo is ambiguous. Keep the original cutout.
  if (tail < pixelCount * 0.9) {
    for (let i = 0; i < tail; i++) data[queue[i] * 4 + 3] = 0;
  }

  // Remove isolated compression flecks, while keeping substantial detached
  // lettering and components that use a meaningful crest color.
  seen.fill(0);
  const speckleLimit = Math.max(2, Math.min(18, Math.floor(pixelCount * 0.0006)));
  for (let seed = 0; seed < pixelCount; seed++) {
    if (seen[seed] || !data[seed * 4 + 3]) continue;
    let neutral = 0;
    tail = 1;
    queue[0] = seed;
    seen[seed] = 1;
    for (let head = 0; head < tail; head++) {
      const pixel = queue[head];
      const offset = pixel * 4;
      const min = Math.min(data[offset], data[offset + 1], data[offset + 2]);
      const max = Math.max(data[offset], data[offset + 1], data[offset + 2]);
      if (min >= 150 && max - min <= 42) neutral++;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const next = ny * width + nx;
          if (seen[next] || !data[next * 4 + 3]) continue;
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (tail <= speckleLimit && neutral === tail) {
      for (let i = 0; i < tail; i++) data[queue[i] * 4 + 3] = 0;
    }
  }

  let left = width, top = height, right = -1, bottom = -1;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    if (!data[pixel * 4 + 3]) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  if (right < left || (left === 0 && top === 0 && right === width - 1 && bottom === height - 1)) return image;

  const croppedWidth = right - left + 1;
  const croppedHeight = bottom - top + 1;
  const cropped = Buffer.alloc(croppedWidth * croppedHeight * 4);
  for (let y = 0; y < croppedHeight; y++) {
    const offset = ((top + y) * width + left) * 4;
    cropped.set(data.subarray(offset, offset + croppedWidth * 4), y * croppedWidth * 4);
  }
  return { width: croppedWidth, height: croppedHeight, data: cropped };
}

module.exports = { cleanTournamentLogo };
