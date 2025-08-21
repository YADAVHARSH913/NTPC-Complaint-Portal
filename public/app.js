// public/app.js
const q  = (s, r=document) => r.querySelector(s);
const qa = (s, r=document) => [...r.querySelectorAll(s)];
const api = async (url, opts={}) => {
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
};

document.addEventListener('DOMContentLoaded', () => {
  qa('[data-logout="admin"]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/api/admin/logout', { method:'POST' });
    location.href = '/';
  }));
  qa('[data-logout="employer"]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/api/employer/logout', { method:'POST' });
    location.href = '/';
  }));
});

// ---------- Employer Login ----------
(function mountEmployerLogin(){
  const form = q('#employerLoginForm');
  if (!form) return;
  const msg = q('#empLoginMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg && (msg.innerHTML = '<div class="text-sm text-gray-500">Submitting...</div>');

    const fd = new FormData(form);
    try {
      const res = await fetch('/api/employer/login', { method:'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        location.href = '/employer';
      } else {
        msg && (msg.innerHTML = `<div class="mt-2 text-sm text-rose-500">${data.message || 'Login failed'}</div>`);
      }
    } catch (err) {
      msg && (msg.innerHTML = `<div class="mt-2 text-sm text-rose-500">Network error</div>`);
    }
  });
})();

// ---------- Admin Login ----------
(function mountAdminLogin(){
  const form = q('#adminLoginForm');
  if (!form) return;
  const msg = q('#adminLoginMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg && (msg.innerHTML = '<div class="text-sm text-gray-500">Signing in...</div>');

    const fd = new FormData(form);
    const body = {
      username: fd.get('username'),
      password: fd.get('password')
    };
    const res = await api('/api/admin/login', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    if (res.success) location.href = '/admin';
    else msg && (msg.innerHTML = `<div class="mt-2 text-sm text-rose-500">${res.message || 'Invalid credentials'}</div>`);
  });
})();

// ---------- Employer Dashboard ----------
(async function mountEmployerDash(){
  const wrap = q('#empDash');
  if (!wrap) return;

  const me = await api('/api/employer/me');
  if (!me.employer) { location.href = '/employer/login'; return; }

  // Welcome
  q('#empWelcome').innerHTML = `
    <div class="flex items-center gap-4">
      <img src="${me.employer.photoPath || 'https://api.dicebear.com/7.x/initials/svg?seed=' + (me.employer.name||'E')}" class="h-12 w-12 rounded-xl ring-1 ring-white/20"/>
      <div>
        <div class="text-lg font-semibold text-white">Welcome, ${me.employer.name}</div>
        <div class="text-xs text-white/70">${me.employer.mobile}</div>
      </div>
    </div>`;

  async function loadComplaints() {
    const resp = await api('/api/employer/complaints');
    const list = (resp.complaints || []);
    q('#empTableBody').innerHTML = list.map(c => `
      <tr class="border-b border-white/10">
        <td class="px-3 py-2 text-white/80">${c._id.slice(-6)}</td>
        <td class="px-3 py-2 text-white">${c.title}</td>
        <td class="px-3 py-2"><span class="px-2 py-1 rounded bg-white/10 text-xs text-white">${c.status}</span></td>
        <td class="px-3 py-2 text-white/70">${new Date(c.createdAt).toLocaleString()}</td>
        <td class="px-3 py-2">${c.imagePath ? `<a class="text-sky-300 underline" href="${c.imagePath}" target="_blank">View</a>` : '<span class="text-white/50">—</span>'}</td>
      </tr>
    `).join('') || `<tr><td colspan="5" class="px-3 py-6 text-center text-white/70">No complaints yet.</td></tr>`;
  }
  await loadComplaints();

  const form = q('#newComplaintForm');
  form && form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const msg = q('#empFormMsg');
    msg.innerHTML = '<div class="text-sm text-white/70">Submitting...</div>';

    const res = await fetch('/api/employer/complaints', { method:'POST', body: fd });
    if (!res.ok) {
      const t = await res.json().catch(()=>({ error:'Failed' }));
      msg.innerHTML = `<div class="text-sm text-rose-400">${t.error || 'Failed'}</div>`;
      return;
    }
    msg.innerHTML = `<div class="text-sm text-emerald-400">Complaint submitted</div>`;
    form.reset();
    await loadComplaints();
  });
})();

// ---------- Admin Dashboard ----------
(async function mountAdminDash(){
  const wrap = q('#adminDash');
  if (!wrap) return;

  const me = await api('/api/admin/me');
  if (!me.admin) { location.href = '/admin/login'; return; }
  q('#adminWelcome').textContent = `Admin: ${me.admin.username}`;

  // ---------- Pending Employers ----------
  async function loadPendingEmployers() {
    const data = await api('/api/admin/employers/pending');
    const list = q('#pendingList');
    if (!list) return;
    list.innerHTML = '';

    if (!data.success || !data.pending || data.pending.length === 0) {
      list.innerHTML = `<div class="text-sm text-white/60">No pending approvals 🎉</div>`;
      return;
    }

    data.pending.forEach(emp => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-3 rounded-xl bg-white/5 ring-1 ring-white/10';
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <img src="${emp.photoPath || 'https://api.dicebear.com/7.x/initials/svg?seed=' + (emp.name||'E')}" class="h-10 w-10 rounded-lg ring-1 ring-white/20"/>
          <div>
            <div class="text-white font-medium">${emp.name}</div>
            <div class="text-xs text-white/70">${emp.mobile}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" data-accept="${emp._id}">Accept</button>
          <button class="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30" data-reject="${emp._id}">Reject</button>
        </div>`;
      list.appendChild(div);
    });

    qa('[data-accept]').forEach(b => b.addEventListener('click', async () => {
      const id = b.getAttribute('data-accept');
      await api(`/api/admin/employers/${id}/accept`, { method:'PATCH' });
      await loadPendingEmployers();
      await loadComplaints();
    }));
    qa('[data-reject]').forEach(b => b.addEventListener('click', async () => {
      const id = b.getAttribute('data-reject');
      await api(`/api/admin/employers/${id}/reject`, { method:'PATCH' });
      await loadPendingEmployers();
      await loadComplaints();
    }));
  }
  await loadPendingEmployers();

  // ---------- Complaints ----------
  const statusSel = q('#filterStatus');
  statusSel && statusSel.addEventListener('change', () => loadComplaints());

  async function loadComplaints() {
    const status = statusSel ? statusSel.value : '';
    const res = await api('/api/admin/complaints' + (status ? `?status=${encodeURIComponent(status)}` : ''));
    const rows = (res.complaints||[]).map(c => `
      <tr class="border-b border-white/10">
        <td class="px-3 py-2 text-white/70">${c._id.slice(-6)}</td>
        <td class="px-3 py-2 text-white">
          ${c.title}
          <div class="text-xs text-white/60">${c.department||''} • ${c.location||''} • Priority: ${c.priority||'Low'}</div>
        </td>
        <td class="px-3 py-2 text-white">
          ${c.employerId?.name || '—'}
          <div class="text-xs text-white/60">${c.employerId?.mobile || ''}</div>
        </td>
        <td class="px-3 py-2"><span class="px-2 py-1 rounded bg-white/10 text-xs text-white">${c.status}</span></td>
        <td class="px-3 py-2 text-white/70">${new Date(c.createdAt).toLocaleString()}</td>
        <td class="px-3 py-2">${c.imagePath ? `<a class="text-sky-300 underline" href="${c.imagePath}" target="_blank">View</a>` : '<span class="text-white/50">—</span>'}</td>
        <td class="px-3 py-2">
          <form class="statusForm flex flex-col gap-2" data-id="${c._id}">
            <select name="status" class="bg-white/10 text-white rounded p-2">
              ${['Pending','In Progress','Closed','Rejected'].map(s => `<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <textarea name="resolutionNotes" rows="2" class="bg-white/10 text-white rounded p-2" placeholder="Resolution notes (if any)">${c.resolutionNotes||''}</textarea>
            <button class="px-3 py-2 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30" type="submit">Update</button>
          </form>
        </td>
      </tr>
    `).join('');
    q('#adminTableBody').innerHTML = rows || `<tr><td colspan="7" class="px-3 py-6 text-center text-white/70">No complaints.</td></tr>`;

    qa('.statusForm').forEach(f => {
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = f.dataset.id;
        const fd = new FormData(f);
        const body = {
          status: fd.get('status'),
          resolutionNotes: fd.get('resolutionNotes')
        };
        const resp = await api(`/api/admin/complaints/${id}/status`, {
          method:'PATCH',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(body)
        });
        if (resp.success) loadComplaints();
      });
    });
  }
  await loadComplaints();

  // ---------- Machines ----------
  async function loadMachines() {
    const res = await api('/api/admin/machines');
    const grid = q('#machinesGrid');
    if (!grid) return;
    grid.innerHTML = (res.machines||[]).map(m => `
      <div class="p-4 rounded-xl bg-white/5 ring-1 ring-white/10 flex flex-col gap-2">
        <div class="text-white/70 text-sm">${m.name}</div>
        <form class="machineForm flex flex-col gap-2" data-id="${m._id}">
          <select name="status" class="bg-white/10 text-white rounded p-2">
            ${['Running','Maintenance','Stopped','Faulty'].map(s => `<option ${m.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <button type="submit" class="px-2 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 text-sm">Update</button>
        </form>
      </div>
    `).join('');

    qa('.machineForm').forEach(f => {
      f.addEventListener('submit', async e => {
        e.preventDefault();
        const id = f.dataset.id;
        const fd = new FormData(f);
        const body = { status: fd.get('status') };
        await api(`/api/admin/machines/${id}/status`, {
          method:'PATCH',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(body)
        });
        await loadMachines();
      });
    });
  }
  await loadMachines();
})();
