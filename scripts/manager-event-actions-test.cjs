const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-event-actions-'));
const out = path.join(dir, 'test.cjs');
try {
  esbuild.buildSync({ stdin: { resolveDir: process.cwd(), loader:'tsx', contents: `
    import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
    import assert from 'node:assert/strict';
    import {isPublicSchedulePath} from './src/lib/scheduleAccess';
    import {ManagerScheduleEventActions as Actions} from './src/manager/components/ManagerScheduleEventActions';
    for (const p of ['/manager/termine','/manager/spiele','/manager/turniere','/app/termine','/demo/termine'])
      assert.equal(isPublicSchedulePath(p),false,p);
    for (const p of ['/schedule','/live','/manager-other','/app-other','/'])
      assert.equal(isPublicSchedulePath(p),true,p);
    let edits=0,deletes=0;
    const props={allowed:true,eventId:'fixture-event',onEdit:()=>edits++,onDelete:()=>deletes++};
    const markup=renderToStaticMarkup(<Actions {...props}/>);
    assert(markup.includes('Termin bearbeiten') && markup.includes('Termin löschen') && markup.includes('fixture-event'));
    assert.equal(renderToStaticMarkup(<Actions {...props} allowed={false}/>),'');
    const tree=Actions(props); const buttons=tree.props.children;
    buttons[0].props.onClick(); buttons[1].props.onClick();
    assert.equal(edits,1); assert.equal(deletes,1);
    let stopped=false;tree.props.onClick({stopPropagation:()=>stopped=true});assert(stopped);
  `}, outfile:out, bundle:true, format:'cjs', platform:'node', logLevel:'silent' });
  require(out);
  const page=fs.readFileSync('src/pages/SchedulePage.tsx','utf8');
  assert(page.includes('isPublicSchedulePath(pathname, managerSimpleMode)'));
  assert.equal((page.match(/allowed={basePath === '\/manager' && canMutateSchedule && !isArchivedEvent && ev.team_season_id === effectiveTeamSeasonId}/g)??[]).length,3);
  assert(page.includes("window.confirm('Termin wirklich löschen?')"));
  assert(page.includes('assertTeamSeasonWritable(event.team_season_id)'));
  assert(page.includes('Termin erstellen'));
  console.log('PASS Manager schedule: internal route classification, visible edit/delete, callback wiring, archive/team guards and existing delete confirmation');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
