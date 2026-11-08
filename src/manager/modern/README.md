# Isolated Manager design comparison

This branch is a preview of the real Manager, with the same routes, permission checks and existing feature components. Do not merge its preview configuration into develop or main.

The preview uses the existing TEST database and proxies `/api/*` to the existing TEST server. Data writes affect the shared TEST data. It has no separate database, no privileged keys and no new access grants. Login and database policies remain enforced by the existing application.

`previewClientConfig.json` contains only the public browser configuration already served by app.spielzeitapp.at; it is injected only when building the comparison Git branch. The live database cannot be selected through that configuration. The existing project's production domain is not changed.

The staging project's ignored-build rule enables this exact comparison branch. The LIVE project's build stays skipped. This PR must remain a draft until the design has been compared and the preview-specific routing/configuration has been removed from any future integration change.
