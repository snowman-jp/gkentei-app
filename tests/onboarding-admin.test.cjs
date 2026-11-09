// Regression checks: production onboarding must never point at staging, and quiz/history files stay unchanged.
const fs=require('node:fs');const assert=require('node:assert/strict');
const root=p=>fs.readFileSync(p,'utf8');
const signup=root('signup.html'), admin=root('admin.html'), index=root('index.html'),
cfg=root('production-config.js'), sync=root('cloud-sync.js'), sql=root('supabase/migrations/20261110_production_self_signup_admin.sql');
assert.match(signup,/auth\/v1\/signup\?redirect_to=/);
assert.match(signup,/minlength="12"/);
assert.match(signup,/production-config\.js/);
assert.match(admin,/admin_sync_overview/);
assert.match(admin,/production-config\.js/);
assert.match(index,/href="\.\/signup\.html"/);
assert.match(sync,/gkentei-formal-cloud-opt-in-v1/);
assert.match(cfg,/kuduxlkmuvongfdqyjoc/);
assert.doesNotMatch(cfg,/racglzpuhofqwfkpfxpo/);
assert.doesNotMatch(signup+admin,/GKENTEI_STAGING_CONFIG/);
assert.match(sql,/on auth\.users for each row/);
assert.match(sql,/app_admins/);
assert.match(sql,/raise exception 'Access denied'/);
assert.doesNotMatch(sql,/delete\s+from\s+public\.answer_events|truncate\s+public|drop\s+table\s+public\.answer_events/i);
console.log('Production self-signup/admin static regression checks passed.');
