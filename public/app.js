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

// ---------- Admin Dashboard (UPDATED SECTION) ----------
(async function mountAdminDash(){
  const wrap = q('#adminDash');
  if (!wrap) return;

  const me = await api('/api/admin/me');
  if (!me.admin) { location.href = '/admin/login'; return; }
  q('#adminWelcome').textContent = `Welcome ${me.admin.username},`;

  // ---------- Pending Employers ----------
  async function loadPendingEmployers() {
    const data = await api('/api/admin/employers/pending');
    const list = q('#pendingList');
    if (!list) return;
    list.innerHTML = '';

    if (!data.success || !data.pending || data.pending.length === 0) {
      list.innerHTML = `<div class="text-sm text-slate-400">No pending approvals 🎉</div>`;
      return;
    }

    data.pending.forEach(emp => {
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-3 rounded-lg bg-slate-900/50';
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <img src="${emp.photoPath || 'https://api.dicebear.com/7.x/initials/svg?seed=' + (emp.name||'E')}" class="h-10 w-10 rounded-full"/>
          <div>
            <div class="text-white font-medium">${emp.name}</div>
            <div class="text-xs text-slate-400">${emp.mobile}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 text-xs font-semibold" data-accept="${emp._id}">Accept</button>
          <button class="px-3 py-1 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/40 text-xs font-semibold" data-reject="${emp._id}">Reject</button>
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

  // ---------- Complaints (New Logic) ----------
  function setupCustomDropdown() {
    const dropdown = q('#status-dropdown');
    if (!dropdown) return;
    
    const button = q('.dropdown-button', dropdown);
    const menu = q('.dropdown-menu', dropdown);
    const options = qa('.dropdown-option', dropdown);
    const buttonText = q('span.block', button);

    button.addEventListener('click', () => {
      menu.classList.toggle('hidden');
    });

    options.forEach(option => {
      option.addEventListener('click', () => {
        const value = option.dataset.value;
        const text = option.textContent;
        
        buttonText.textContent = text;
        menu.classList.add('hidden');
        
        loadComplaints(value); 
      });
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
  }
  setupCustomDropdown();

  async function loadComplaints(status = '') {
    const res = await api('/api/admin/complaints' + (status ? `?status=${encodeURIComponent(status)}` : ''));
    const complaints = res.complaints || [];

    const rows = complaints.map(c => `
      <tr class="hover:bg-slate-800">
        <td class="px-4 py-3 text-slate-400">${c._id?.slice(-6) || 'N/A'}</td>
        <td class="px-4 py-3 text-white font-medium">
          ${c.title}
          <div class="text-xs text-slate-400 font-normal">${c.department||''} • ${c.location||''} • Priority: ${c.priority||'Low'}</div>
        </td>
        <td class="px-4 py-3">
          <div class="text-white">${c.employerId?.name || '—'}</div>
          <div class="text-xs text-slate-400">${c.employerId?.mobile || ''}</div>
        </td>
        <td class="px-4 py-3">
            <span class="px-2 py-1 rounded-full text-xs font-medium 
            ${c.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-300' : ''}
            ${c.status === 'In Progress' ? 'bg-sky-500/20 text-sky-300' : ''}
            ${c.status === 'Closed' ? 'bg-emerald-500/20 text-emerald-300' : ''}
            ${c.status === 'Rejected' ? 'bg-red-500/20 text-red-300' : ''}
            ">${c.status}</span>
        </td>
        <td class="px-4 py-3 text-slate-400">${new Date(c.createdAt).toLocaleDateString()}</td>
        <td class="px-4 py-3">${c.imagePath ? `<a class="text-sky-400 hover:underline" href="${c.imagePath}" target="_blank">View</a>` : '<span class="text-slate-500">—</span>'}</td>
        <td class="px-4 py-3">
          <button data-update-id="${c._id}" class="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-sky-600 text-white text-xs font-medium">Update</button>
        </td>
      </tr>
    `).join('');
    q('#adminTableBody').innerHTML = rows || `<tr><td colspan="7" class="px-4 py-10 text-center text-slate-400">No complaints found.</td></tr>`;

    const updateModal = q('#updateModal');
    const updateForm = q('#updateStatusForm');
    const closeModalBtn = q('#closeModalBtn');
    const cancelModalBtn = q('#cancelModalBtn');

    const openModal = (complaint) => {
        q('#modalComplaintTitle').textContent = complaint.title;
        q('#modalStatus').innerHTML = ['Pending','In Progress','Closed','Rejected']
            .map(s => `<option value="${s}" ${complaint.status === s ? 'selected' : ''}>${s}</option>`).join('');
        q('#modalResolutionNotes').value = complaint.resolutionNotes || '';
        updateForm.dataset.id = complaint._id;
        updateModal.classList.remove('hidden');
    };

    const closeModal = () => updateModal.classList.add('hidden');

    qa('[data-update-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const complaintId = btn.dataset.updateId;
            const complaint = complaints.find(c => c._id === complaintId);
            if (complaint) openModal(complaint);
        });
    });

    closeModalBtn.onclick = closeModal;
    cancelModalBtn.onclick = closeModal;

    updateForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = updateForm.dataset.id;
        const fd = new FormData(updateForm);
        const body = {
            status: fd.get('status'),
            resolutionNotes: fd.get('resolutionNotes')
        };
        const resp = await api(`/api/admin/complaints/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (resp.success) {
            closeModal();
            await loadComplaints();
        }
    };
  }
  await loadComplaints();

 // ---------- Export PDF ----------
  const exportBtn = q('#exportPDF');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      // Get status from the custom dropdown's button text
      const dropdownButtonText = q('#status-dropdown .dropdown-button span.block')?.textContent || 'All';
      const status = dropdownButtonText === 'All' ? '' : dropdownButtonText;

      const url = '/api/admin/complaints/export' + (status ? `?status=${encodeURIComponent(status)}` : '');
      window.open(url, "_blank");
    });
  }

})();