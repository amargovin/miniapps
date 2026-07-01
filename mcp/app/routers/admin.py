"""Admin surface: groups + members + usage dashboard.

Model: a GROUP carries the quota + rate limits; MEMBERS (subscriber URLs) live
under it and share the group's limits (usage is counted per group). Internally a
group is a `Client` row and a member is a `ClientToken` row.

Gated by the X-Admin-Key header (matches ADMIN_API_KEY). NOT behind the client
gateway. Endpoints under /admin/api/*; a server-rendered console at GET /admin.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Client
from app.runtime import get_settings
from app.schemas import AddMemberReq, GroupCreate, GroupOut, GroupUpdate, MemberCreated, MemberOut
from app.services import tokens as tokensvc
from app.services import usage
from app.util import utcnow

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    key = get_settings().admin_api_key
    if not key:
        raise HTTPException(503, "admin disabled: set ADMIN_API_KEY")
    if x_admin_key != key:
        raise HTTPException(401, "invalid admin key")


def _group_out(client: Client) -> GroupOut:
    return GroupOut.model_validate({**client.__dict__, "members": []})


@router.post("/api/groups", response_model=GroupOut, dependencies=[Depends(require_admin)])
async def create_group(body: GroupCreate, db: AsyncSession = Depends(get_db)) -> GroupOut:
    client = await tokensvc.create_client(
        db,
        name=body.name,
        description=body.description,
        contact_email=body.contact_email,
        rate_limit_per_minute=body.rate_limit_per_minute,
        monthly_request_quota=body.monthly_request_quota,
        created_by="admin",
    )
    return _group_out(client)


@router.get("/api/groups", response_model=list[GroupOut], dependencies=[Depends(require_admin)])
async def list_groups(db: AsyncSession = Depends(get_db)) -> list[GroupOut]:
    clients = await tokensvc.list_clients(db)
    base = get_settings().public_base_url.rstrip("/")
    month_stats = await usage.stats_by_client(db, since=usage.month_start())
    all_stats = await usage.stats_by_client(db)

    out: list[GroupOut] = []
    for c in clients:
        go = _group_out(c)
        members: list[MemberOut] = []
        for t in c.tokens:
            m = MemberOut.model_validate(t)
            if t.is_active and t.raw_token:
                m.subscriber_url = f"{base}/s/{t.raw_token}/mcp"
            members.append(m)
        go.members = members
        ms = month_stats.get(c.id, {})
        al = all_stats.get(c.id, {})
        go.requests_this_month = ms.get("requests", 0)
        go.requests_total = al.get("requests", 0)
        go.input_tokens_total = al.get("input_tokens", 0)
        go.output_tokens_total = al.get("output_tokens", 0)
        go.last_active = al.get("last_active")
        out.append(go)
    return out


@router.post("/api/groups/{group_id}", response_model=GroupOut, dependencies=[Depends(require_admin)])
async def update_group(
    group_id: str, body: GroupUpdate, db: AsyncSession = Depends(get_db)
) -> GroupOut:
    updated = await tokensvc.update_client(db, group_id, body.model_dump(exclude_unset=True))
    if updated is None:
        raise HTTPException(404, "group not found")
    return _group_out(updated)


@router.delete("/api/groups/{group_id}", dependencies=[Depends(require_admin)])
async def delete_group(group_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    if not await tokensvc.delete_client(db, group_id):
        raise HTTPException(404, "group not found")
    return {"deleted": group_id}


@router.post(
    "/api/groups/{group_id}/members",
    response_model=MemberCreated,
    dependencies=[Depends(require_admin)],
)
async def add_member(
    group_id: str, body: AddMemberReq, db: AsyncSession = Depends(get_db)
) -> MemberCreated:
    if await db.get(Client, group_id) is None:
        raise HTTPException(404, "group not found")
    expires_at = (
        utcnow() + timedelta(days=body.expires_in_days) if body.expires_in_days else None
    )
    raw, token = await tokensvc.create_token(
        db, group_id, label=body.label, expires_at=expires_at
    )
    base = get_settings().public_base_url.rstrip("/")
    return MemberCreated(
        token=raw,
        token_id=token.token_id,
        group_id=group_id,
        label=token.label,
        expires_at=token.expires_at,
        subscriber_url=f"{base}/s/{raw}/mcp",
    )


@router.post("/api/members/{member_id}/revoke", dependencies=[Depends(require_admin)])
async def revoke_member(member_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    if not await tokensvc.revoke_token(db, member_id):
        raise HTTPException(404, "member not found")
    return {"revoked": member_id}


@router.get("/api/defaults", dependencies=[Depends(require_admin)])
async def defaults() -> dict:
    s = get_settings()
    return {
        "rate_limit_per_minute_default": s.rate_limit_per_minute_default,
        "monthly_request_quota_default": s.monthly_request_quota_default,
    }


@router.get("", response_class=HTMLResponse, include_in_schema=False)
async def admin_console() -> str:
    return _ADMIN_HTML


_ADMIN_HTML = """<!doctype html><meta charset=utf-8>
<title>Swarajya MCP — Admin</title>
<style>
 body{font:14px/1.5 system-ui;margin:2rem;max-width:960px;color:#222}
 input,button,select{font:inherit;padding:.35rem}
 .tok{background:#fffbe6;border:1px solid #e6c84d;padding:.6rem;margin:.4rem 0;word-break:break-all}
 .group{border:1px solid #ddd;border-radius:8px;padding:.8rem;margin:.6rem 0}
 .member{margin:.2rem 0 .2rem 1rem;padding-left:.5rem;border-left:2px solid #eee}
 .muted{color:#777}.row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
 .stat{display:inline-block;background:#f2f4f7;border-radius:5px;padding:.15rem .5rem;margin:.15rem .2rem}
 .totals{background:#eef6ff;border:1px solid #cfe3fb;border-radius:8px;padding:.7rem;margin:.6rem 0}
 button{cursor:pointer}.danger{color:#a00}h1{margin-bottom:.3rem}
</style>
<h1>Swarajya MCP — Admin</h1>
<p class=muted>Create a <b>group</b> (with its quota), then add <b>members</b> to it. Each member gets a connector URL; all members share the group's quota.</p>
<p><label>Admin key <input id=key type=password size=40 placeholder="X-Admin-Key"></label>
<button onclick=load()>Load</button></p>
<div id=totals></div>
<h3>New group</h3>
<div class=row>
 <input id=name placeholder="group name (e.g. Varahe Analytics)">
 <input id=rl type=number placeholder="rate/min" style=width:6.5rem>
 <input id=q type=number placeholder="quota/mo" style=width:7rem>
 <button onclick=createGroup()>Create group</button>
</div>
<div id=out></div>
<script>
const G=id=>document.getElementById(id);
const H=()=>({'X-Admin-Key':G('key').value,'Content-Type':'application/json'});
const esc=s=>(s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=s=>s?new Date(s).toLocaleString():'never';

async function load(){
 const r=await fetch('/admin/api/groups',{headers:H()});
 if(!r.ok){G('out').innerHTML='<p class=muted>'+r.status+' — check admin key</p>';G('totals').innerHTML='';return;}
 const gs=await r.json();
 const D=await (await fetch('/admin/api/defaults',{headers:H()})).json();
 const tReq=gs.reduce((a,c)=>a+c.requests_this_month,0);
 const tIn=gs.reduce((a,c)=>a+c.input_tokens_total,0);
 const tOut=gs.reduce((a,c)=>a+c.output_tokens_total,0);
 G('totals').innerHTML=`<div class=totals><b>${gs.length}</b> groups ·
   <b>${tReq}</b> requests this month · server LLM tokens all-time: <b>${tIn}</b> in / <b>${tOut}</b> out
   <div class=muted>defaults: ${D.rate_limit_per_minute_default}/min · ${D.monthly_request_quota_default??'∞'}/month (each group can override)</div></div>`;
 G('out').innerHTML=gs.map(c=>`
  <div class=group id="g-${c.id}">
   <div class=row><b>${esc(c.name)}</b> ${c.is_active?'':'<span class=muted>(inactive)</span>'}</div>
   <div class=muted>${c.id}</div>
   <div>
     <span class=stat>this month: ${c.requests_this_month} / ${c.monthly_request_quota??(D.monthly_request_quota_default??'∞')} req</span>
     <span class=stat>rate: ${c.rate_limit_per_minute??D.rate_limit_per_minute_default}/min</span>
     <span class=stat>total: ${c.requests_total} req</span>
     <span class=stat>LLM tokens: ${c.input_tokens_total}/${c.output_tokens_total}</span>
     <span class=stat>last active: ${when(c.last_active)}</span>
   </div>
   <div class=row style="margin-top:.4rem">
     <input class=e-rl type=number placeholder="rate/min" value="${c.rate_limit_per_minute??''}" style=width:6.5rem>
     <input class=e-q type=number placeholder="quota/mo" value="${c.monthly_request_quota??''}" style=width:7rem>
     <button onclick="saveGroup('${c.id}')">Save limits</button>
     ${c.is_active?`<button onclick="setActive('${c.id}',false)">deactivate</button>`
                  :`<button onclick="setActive('${c.id}',true)">activate</button>`}
     <button class=danger onclick="delGroup('${c.id}')">delete group</button>
   </div>
   <div style="margin-top:.5rem"><b>Members</b>
     ${c.members.map(m=>`<div class="row member">
        <span class=muted>${esc(m.label)||'(unnamed)'} · ${m.token_id} ${m.is_active?'':'· revoked'}</span>
        ${m.is_active&&m.subscriber_url?`<button onclick="copyText(this,'${m.subscriber_url}')">Copy URL</button>`:''}
        ${m.is_active?`<button onclick="revokeMember('${m.id}')">revoke</button>`:''}</div>`).join('')||'<div class="member muted">no members yet</div>'}
     <div class="row member">
       <input class=m-label placeholder="new member (e.g. ravi@x.com)">
       <button onclick="addMember('${c.id}')">+ add member</button>
     </div>
   </div>
  </div>`).join('')||'<p class=muted>no groups yet</p>';
}
async function createGroup(){
 const nm=G('name').value.trim();
 if(!nm){alert('Group name is required');return;}
 const body={name:nm,rate_limit_per_minute:G('rl').value?+G('rl').value:null,
   monthly_request_quota:G('q').value?+G('q').value:null};
 const r=await fetch('/admin/api/groups',{method:'POST',headers:H(),body:JSON.stringify(body)});
 if(!r.ok){G('out').insertAdjacentHTML('afterbegin',`<div class=tok>Create failed (${r.status}): ${esc(await r.text())}</div>`);return;}
 G('name').value=G('rl').value=G('q').value='';load();
}
async function saveGroup(id){
 const card=G('g-'+id);
 const body={rate_limit_per_minute:card.querySelector('.e-rl').value?+card.querySelector('.e-rl').value:null,
   monthly_request_quota:card.querySelector('.e-q').value?+card.querySelector('.e-q').value:null};
 const r=await fetch('/admin/api/groups/'+id,{method:'POST',headers:H(),body:JSON.stringify(body)});
 if(!r.ok){alert('Save failed: '+r.status);return;}load();
}
async function setActive(id,active){
 await fetch('/admin/api/groups/'+id,{method:'POST',headers:H(),body:JSON.stringify({is_active:active})});load();
}
async function delGroup(id){
 if(!confirm('Delete this group and all its members? Usage history is kept.'))return;
 await fetch('/admin/api/groups/'+id,{method:'DELETE',headers:H()});load();
}
async function addMember(gid){
 const card=G('g-'+gid);
 const label=card.querySelector('.m-label').value.trim();
 const r=await fetch(`/admin/api/groups/${gid}/members`,{method:'POST',headers:H(),body:JSON.stringify({label:label||null})});
 if(!r.ok){alert('Could not add member: '+r.status);return;}
 const m=await r.json();
 G('out').insertAdjacentHTML('afterbegin',
   `<div class=tok>Connector URL for <b>${esc(m.label)||'member'}</b> — shown once:
    <div class=row><input readonly style="flex:1;min-width:22rem" value="${m.subscriber_url}">
    <button onclick="copyText(this,'${m.subscriber_url}')">Copy</button></div></div>`);
 load();
}
async function revokeMember(id){await fetch(`/admin/api/members/${id}/revoke`,{method:'POST',headers:H()});load();}
function copyText(btn,text){
 navigator.clipboard.writeText(text).then(
   ()=>{const o=btn.textContent;btn.textContent='Copied!';setTimeout(()=>btn.textContent=o,1500);},
   ()=>{window.prompt('Copy this URL:',text);});
}
</script>
"""
