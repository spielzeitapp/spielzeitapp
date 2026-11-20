# Listing photo height correction — TEST and LIVE

Bound the photo rail to min(125vw, 60dvh, 640px) with 220px minimum; slide has a definite 100% height, zero intrinsic minimum, clipped overflow and positioned cover image. This prevents oversized screenshot/image intrinsic dimensions from expanding or overflowing the gallery grid. Remove top padding on the member detail section directly containing the gallery. Header, standalone viewport/nav recovery, and stored image files are untouched.

The reported TEST listing photo was inspected via the public image endpoint. It is a full older marketplace screenshot containing its own header, arrows and dots. Those embedded controls are image pixels and cannot be removed by layout CSS. Replacing that test image with the original photo is needed for a clean photo; no user's stored image was overwritten or cropped.

Existing gallery interaction test and release hash validation pass; production builds checked on both branch bases. No DB schema/data changes. No physical-device rendering verification claimed.
