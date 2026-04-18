/**
 * gruppo.js — Gestione gruppi condivisi
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireLogin();
    if (!currentUser) return;

    const usernameEl = document.getElementById('sidebar-username');
    if (usernameEl) usernameEl.textContent = currentUser.username;
    const avatarEl = document.getElementById('sidebar-avatar');
    if (avatarEl) avatarEl.textContent = currentUser.username[0].toUpperCase();

    initSidebar();
    initLogout();
    initTabs();
    initForms();
    renderActiveContextBar();
    await loadGroups();
});

// ============================================================
// TABS
// ============================================================

function initTabs() {
    document.querySelectorAll('.pill-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.pill-tab').forEach(b => b.classList.toggle('active', b === btn));
            document.getElementById('section-my-groups').classList.toggle('hidden', tab !== 'my-groups');
            document.getElementById('section-create').classList.toggle('hidden',    tab !== 'create');
            document.getElementById('section-join').classList.toggle('hidden',      tab !== 'join');
        });
    });
}

// ============================================================
// CARICAMENTO GRUPPI
// ============================================================

async function loadGroups() {
    document.getElementById('groups-loader').style.display = 'flex';
    document.getElementById('groups-list').style.display   = 'none';

    try {
        const res = await api.get('/groups/my_groups.php');
        document.getElementById('groups-loader').style.display = 'none';
        document.getElementById('groups-list').style.display   = 'block';

        if (res.success) {
            renderGroups(res.groups);
        } else {
            document.getElementById('groups-list').innerHTML =
                `<div class="alert alert-warning">${escapeHtml(res.message || 'Errore nel caricamento')}</div>`;
        }
    } catch {
        document.getElementById('groups-loader').style.display = 'none';
        document.getElementById('groups-list').style.display   = 'block';
        document.getElementById('groups-list').innerHTML =
            '<div class="alert alert-warning">Errore di connessione. Ricarica la pagina.</div>';
    }
}

function renderGroups(groups) {
    const container = document.getElementById('groups-list');

    if (!groups.length) {
        container.innerHTML = `
            <div class="no-groups-state">
                <div class="big-icon">👥</div>
                <p>Non fai ancora parte di nessun gruppo.</p>
                <div style="display:flex; gap:0.75rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">
                    <button class="btn btn-primary" onclick="switchTab('create')">Crea un gruppo</button>
                    <button class="btn btn-outline" onclick="switchTab('join')">Entra con codice</button>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = groups.map(g => buildGroupCard(g)).join('');
}

function buildGroupCard(g) {
    const ctx = currentUser.active_context;
    const isActive = ctx && ctx.type === 'group' && ctx.group_id === g.id;
    const isAdmin  = g.role === 'admin';

    const inviteHtml = isAdmin && g.invite_code ? `
        <div class="invite-code-box">
            <span style="font-size:0.78rem; color:var(--text-light);">Codice invito:</span>
            <span class="invite-code" id="code-${g.id}">${escapeHtml(g.invite_code)}</span>
            <button class="btn btn-ghost btn-sm" onclick="copyCode('${escapeHtml(g.invite_code)}')" title="Copia codice">
                📋
            </button>
            <button class="btn btn-ghost btn-sm" onclick="regenerateCode(${g.id})" title="Rigenera codice" style="font-size:0.75rem;">
                🔄
            </button>
        </div>` : '';

    const switchBtn = isActive
        ? `<button class="btn btn-outline btn-sm" onclick="switchContext('personal')">↩ Torna al personale</button>`
        : `<button class="btn btn-primary btn-sm" onclick="switchContext('group', ${g.id})">Attiva contesto</button>`;

    return `
        <div class="group-card" id="group-card-${g.id}">
            <div class="group-card-header">
                <div>
                    <div class="group-name">${escapeHtml(g.name)}</div>
                    ${isActive ? '<span class="context-indicator group" style="margin-top:0.25rem;">✓ Contesto attivo</span>' : ''}
                </div>
                <span class="role-badge ${g.role}">${g.role === 'admin' ? '👑 Admin' : '👤 Membro'}</span>
            </div>
            <div class="group-meta">
                <span>👥 ${g.member_count} membro${g.member_count !== 1 ? 'i' : ''}</span>
                <span>📅 Creato il ${formatDate(g.created_at?.split(' ')[0] || '')}</span>
            </div>
            ${inviteHtml}
            <!-- Placeholder lista membri — caricata al click -->
            <div id="members-${g.id}" style="display:none;"></div>
            <div class="group-actions">
                ${switchBtn}
                <button class="btn btn-outline btn-sm" onclick="toggleMembers(${g.id})">
                    👥 Membri
                </button>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="confirmLeave(${g.id}, '${escapeHtml(g.name)}')">
                    Abbandona
                </button>
            </div>
        </div>`;
}

// ============================================================
// AZIONI GRUPPO
// ============================================================

async function toggleMembers(groupId) {
    const el = document.getElementById(`members-${groupId}`);
    if (el.style.display === 'block') {
        el.style.display = 'none';
        return;
    }
    el.style.display = 'block';
    el.innerHTML = '<div class="loading" style="padding:1rem;"><div class="spinner"></div><span>Caricamento…</span></div>';

    try {
        const res = await api.get(`/groups/info.php?group_id=${groupId}`);
        if (res.success) {
            renderMembersList(el, res.members, res.my_role, groupId);
        } else {
            el.innerHTML = `<div class="alert alert-warning">${escapeHtml(res.message || 'Errore')}</div>`;
        }
    } catch {
        el.innerHTML = '<div class="alert alert-warning">Errore nel caricamento membri.</div>';
    }
}

function renderMembersList(container, members, myRole, groupId) {
    const rows = members.map(m => {
        const isMe = m.id === currentUser.id;
        const adminActions = (myRole === 'admin' && !isMe) ? `
            <div style="display:flex; gap:0.35rem;">
                ${m.role === 'member'
                    ? `<button class="btn btn-ghost btn-sm" onclick="updateRole(${groupId}, ${m.id}, 'admin')" title="Promuovi ad admin">👑</button>`
                    : `<button class="btn btn-ghost btn-sm" onclick="updateRole(${groupId}, ${m.id}, 'member')" title="Declassa a membro">⬇</button>`
                }
                <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="removeMember(${groupId}, ${m.id}, '${escapeHtml(m.username)}')" title="Rimuovi dal gruppo">✕</button>
            </div>` : '';

        return `
            <div class="member-row">
                <div class="member-avatar">${escapeHtml(m.username[0].toUpperCase())}</div>
                <span class="member-name">${escapeHtml(m.username)}${isMe ? ' <small style="color:var(--text-muted);">(tu)</small>' : ''}</span>
                <span class="role-badge ${m.role}">${m.role === 'admin' ? '👑 Admin' : '👤 Membro'}</span>
                ${adminActions}
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="members-list" style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid var(--border-light);">
            ${rows}
        </div>`;
}

async function switchContext(type, groupId = null) {
    const body = type === 'personal' ? { context: 'personal' } : { context: 'group', group_id: groupId };
    try {
        const res = await api.post('/groups/switch.php', body);
        if (res.success) {
            window.location.reload();
        } else {
            showToast(res.message || 'Errore nel cambio contesto', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

async function regenerateCode(groupId) {
    if (!confirm('Vuoi rigenerare il codice invito? Il vecchio codice non sarà più valido.')) return;
    try {
        const res = await api.post('/groups/regenerate_code.php', { group_id: groupId });
        if (res.success) {
            const el = document.getElementById(`code-${groupId}`);
            if (el) el.textContent = res.invite_code;
            showToast('Nuovo codice invito generato', 'success');
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('Codice copiato negli appunti!', 'success');
    }).catch(() => {
        showToast('Impossibile copiare automaticamente. Codice: ' + code, 'info', 5000);
    });
}

async function updateRole(groupId, userId, role) {
    try {
        const res = await api.post('/groups/update_member.php', { group_id: groupId, user_id: userId, role });
        if (res.success) {
            showToast('Ruolo aggiornato', 'success');
            await toggleMembers(groupId);
            await toggleMembers(groupId);
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

async function removeMember(groupId, userId, username) {
    if (!confirm(`Rimuovere ${username} dal gruppo?`)) return;
    try {
        const res = await api.post('/groups/remove_member.php', { group_id: groupId, user_id: userId });
        if (res.success) {
            showToast('Membro rimosso', 'success');
            await loadGroups();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

async function confirmLeave(groupId, groupName) {
    if (!confirm(`Sei sicuro di voler abbandonare il gruppo "${groupName}"?`)) return;
    try {
        const res = await api.post('/groups/leave.php', { group_id: groupId });
        if (res.success) {
            showToast(res.message, 'success');
            await loadGroups();
            renderActiveContextBar();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    }
}

// ============================================================
// FORM: CREA + ENTRA
// ============================================================

function initForms() {
    document.getElementById('btn-create-group')?.addEventListener('click', handleCreate);
    document.getElementById('new-group-name')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleCreate();
    });

    document.getElementById('btn-join-group')?.addEventListener('click', handleJoin);
    document.getElementById('join-code')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleJoin();
    });
    document.getElementById('join-code')?.addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase();
    });
}

async function handleCreate() {
    const input = document.getElementById('new-group-name');
    const name  = input?.value?.trim();
    if (!name) { input?.focus(); showToast('Inserisci un nome per il gruppo', 'warning'); return; }

    const btn = document.getElementById('btn-create-group');
    btn.disabled = true; btn.textContent = 'Creazione…';

    try {
        const res = await api.post('/groups/create.php', { name });
        if (res.success) {
            showToast(res.message, 'success');
            input.value = '';
            switchTab('my-groups');
            await loadGroups();
        } else {
            showToast(res.message || 'Errore nella creazione', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Crea gruppo';
    }
}

async function handleJoin() {
    const input = document.getElementById('join-code');
    const code  = input?.value?.trim().toUpperCase();
    if (!code) { input?.focus(); showToast('Inserisci il codice invito', 'warning'); return; }

    const btn = document.getElementById('btn-join-group');
    btn.disabled = true; btn.textContent = 'Entrata…';

    try {
        const res = await api.post('/groups/join.php', { invite_code: code });
        if (res.success) {
            showToast(res.message, 'success');
            input.value = '';
            switchTab('my-groups');
            await loadGroups();
        } else {
            showToast(res.message || 'Errore', 'error');
        }
    } catch {
        showToast('Errore di connessione', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Entra';
    }
}

// ============================================================
// UTILITY
// ============================================================

function switchTab(tabId) {
    document.querySelectorAll('.pill-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.getElementById('section-my-groups').classList.toggle('hidden', tabId !== 'my-groups');
    document.getElementById('section-create').classList.toggle('hidden',    tabId !== 'create');
    document.getElementById('section-join').classList.toggle('hidden',      tabId !== 'join');
}

function renderActiveContextBar() {
    const ctx = currentUser?.active_context;
    const bar = document.getElementById('active-context-bar');
    if (!bar) return;

    if (ctx && ctx.type === 'group') {
        bar.innerHTML = `
            <div class="location-status" style="justify-content:space-between;">
                <span>Stai visualizzando: <strong>👥 ${escapeHtml(ctx.group_name)}</strong></span>
                <button class="btn btn-ghost btn-sm" onclick="switchContext('personal')">↩ Torna al personale</button>
            </div>`;
    } else {
        bar.innerHTML = `
            <div class="location-status">
                <span>Stai visualizzando: <strong>👤 Dispensa personale</strong></span>
            </div>`;
    }
}

function initLogout() {
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await api.post('/auth/logout.php');
        window.location.href = '../index.html';
    });
}
