-- Explicit deny policy: confirmations are accessible only through checked RPCs.
create policy result_confirmations_no_direct_access
on h2h_private.result_confirmations for all to authenticated
using (false) with check (false);
