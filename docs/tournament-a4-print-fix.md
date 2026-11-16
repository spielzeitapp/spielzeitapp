# A4 print correction

Observed physical iPhone A4 portrait output squeezed a three-column layout and broke team names into letter groups. A4 now requests portrait and uses two columns / three rows (six fixtures per sheet); A3 keeps landscape / three columns. Names use normal word boundaries, and A4 score width is bounded to leave about 31mm per team name. Standings markup and styles are unchanged. Mobile preview explicitly explains its single-column arrangement versus the printed grid.

Validation: presentation renderer tests pass (A4 portrait, A3, pagination, exact fixture coverage, home/away score overlay, QR decoding), TypeScript and build checked. Geometry check with bold 9pt-equivalent font gives Wilhelmsburg 24.8mm within the 31.2mm team column. Actual iPhone printer output requires a new physical print; no browser/PDF rendering verification claimed.
