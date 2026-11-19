# Market manager navigation viewport correction — 19 November 2026

User screenshots show most of the bottom navigation outside the visible iPhone window, both in manager and after switching to public market. Removed positive native status-area translation and the recovered-document absolute anchor. Both body portals now use a fixed flex frame with the measured visualViewport top/height. These values are independent of the main SpielzeitApp document fullscreen recovery. Keyboard and page zoom update the measured frame; actual pinch zoom retains the prior stable measurements. Public and manager content scrollers and SpielzeitApp navigation otherwise unchanged.

Duplicate display names in the manager club picker include their original club name; IDs and authorizations remain separate. No clubs were merged or deleted.

Validation: market-manager-viewport-test, standalone-viewport-policy-test, market-nav-visible-frame-test (effective CSS cascade for cold and in-app entry), market-manager-shell-test, existing manager UI test, TypeScript, production builds. No new SQL. No claim of physical iPhone verification: reproducing the supplied screenshots on the user's installed PWA still requires a device reload and check. Vercel website deployment is tracked separately; Live may remain rate limited.
