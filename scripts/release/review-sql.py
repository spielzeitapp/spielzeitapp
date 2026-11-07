"""Conservative automatic review. Unsupported SQL fails closed, never auto-approved."""
import json,sys
from pglast.parser import parse_sql_json
SCALARS={'text','varchar','bpchar','bool','boolean','int2','int4','int8','integer','bigint','smallint','numeric','float4','float8','jsonb','uuid','timestamptz','timestamp','date'}
def require(ok,message):
 if not ok: raise ValueError(message)
def scalar(t):
 names=[x['String']['sval'] for x in t['names']]
 require(names[-1] in SCALARS and (len(names)==1 or names[:-1]==['pg_catalog']), 'Nicht unterstützter Spaltentyp')
 require(all('A_Const' in x and 'ival' in x['A_Const'] for x in t.get('typmods',[])), 'Typmodifikatoren müssen feste Zahlen sein')
 require(not t.get('arrayBounds') and not t.get('setof'), 'Arrays/Sondertypen benötigen technische Prüfung')
def constant(v):
 if 'A_Const' in v:return not v['A_Const'].get('isnull',False)
 if 'TypeCast' in v:scalar(v['TypeCast']['typeName']);return constant(v['TypeCast']['arg'])
 return False
def expression(v,column):
 if 'A_Const' in v:return
 if 'ColumnRef' in v:
  require(v['ColumnRef']['fields']==[{'String':{'sval':column}}], 'Prüfregel greift auf andere Spalten zu');return
 if 'A_Expr' in v:
  x=v['A_Expr'];require(x['kind'] in ('AEXPR_OP','AEXPR_BETWEEN','AEXPR_IN'), 'Nicht unterstützte Prüfregel')
  operators=('BETWEEN',) if x['kind']=='AEXPR_BETWEEN' else ('=','<>','<','>','<=','>=')
  require(all(n['String']['sval'] in operators for n in x.get('name',[])), 'Nicht unterstützter Operator')
  expression(x['lexpr'],column)
  rhs=x['rexpr'];
  if 'List' in rhs:
   for a in rhs['List']['items']:expression(a,column)
  else:expression(rhs,column)
  return
 if 'BoolExpr' in v:
  for a in v['BoolExpr']['args']:expression(a,column)
  return
 if 'NullTest' in v:expression(v['NullTest']['arg'],column);return
 if 'TypeCast' in v:scalar(v['TypeCast']['typeName']);expression(v['TypeCast']['arg'],column);return
 raise ValueError('Funktionen oder komplexe Prüfregeln benötigen technische Prüfung')
def table(r):
 require(r.get('schemaname')=='public' and not r.get('catalogname'), 'Nur Tabellen im public-Schema werden automatisch geprüft')
 return r['relname']
def inspect(sql):
 targets=set()
 for raw in json.loads(parse_sql_json(sql))['stmts']:
  stmt=raw['stmt']
  if 'NotifyStmt' in stmt:
   n=stmt['NotifyStmt'];require(n.get('conditionname')=='pgrst' and n.get('payload')=='reload schema','Nicht unterstützte Benachrichtigung');continue
  if 'AlterTableStmt' in stmt:
   s=stmt['AlterTableStmt'];targets.add(table(s['relation']))
   require(s.get('objtype')=='OBJECT_TABLE' and not s.get('missing_ok'), 'Nicht unterstützte Tabellenänderung')
   for cmd in s['cmds']:
    c=cmd['AlterTableCmd'];require(c['subtype']=='AT_AddColumn' and not c.get('missing_ok'), 'Automatisch sind nur neue Spalten erlaubt; Löschen/Ändern benötigt technische Prüfung')
    col=c['def']['ColumnDef'];scalar(col['typeName']);require(not col.get('identity') and not col.get('generated') and not col.get('collClause'), 'Generierte Spalten benötigen technische Prüfung')
    default=None;required=False
    for item in col.get('constraints',[]):
     con=item['Constraint'];kind=con['contype']
     require(kind in ('CONSTR_DEFAULT','CONSTR_CHECK','CONSTR_NOTNULL','CONSTR_NULL'), 'Neue Schlüssel/Fremdschlüssel benötigen technische Prüfung')
     if kind=='CONSTR_DEFAULT':require(constant(con['raw_expr']), 'Nur feste Standardwerte werden automatisch geprüft');default=con['raw_expr']
     if kind=='CONSTR_NOTNULL':required=True
     if kind=='CONSTR_CHECK':expression(con['raw_expr'],col['colname'])
    require(not required or default is not None,'Pflichtspalte ohne festen Standardwert benötigt Datenprüfung')
   continue
  if 'IndexStmt' in stmt:
   s=stmt['IndexStmt'];targets.add(table(s['relation']))
   require(not any(s.get(k) for k in ('unique','concurrent','whereClause','indexIncludingParams','excludeOpNames','options','tableSpace')), 'Eindeutige/komplexe Indizes benötigen Datenprüfung')
   require(s.get('accessMethod','btree')=='btree','Nur einfache B-Tree-Indizes unterstützt')
   for e in s['indexParams']:
    p=e['IndexElem'];require(p.get('name') and not any(p.get(k) for k in ('expr','opclass','collation','opclassopts')), 'Indexausdrücke benötigen technische Prüfung')
   continue
  raise ValueError('Diese SQL-Änderung ist nicht automatisch freigabefähig (z. B. Rechte, Funktionen, Daten oder Löschungen). Technische Prüfung erforderlich.')
 require(bool(targets),'Keine unterstützte Strukturänderung enthalten')
 return sorted(targets)
if __name__=='__main__':
 bundle=json.load(open(sys.argv[1]));out=[]
 for f in bundle['files']:
  try:out.append({**f,'targets':inspect(f['sql']),'eligible':True})
  except Exception as e:out.append({**f,'eligible':False,'reason':str(e)})
 json.dump(out,open(sys.argv[2],'w'))
