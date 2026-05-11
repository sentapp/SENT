import React, { createContext, useContext, useMemo, useState } from 'react';

const AppStateContext = createContext(null);

function createEmptyState() {
  return {
    missionary: {
      profile: {
        name: '',
        organization: '',
        missionStatement: '',
        locationName: '',
        locationCoords: null, // { lat, lng }
        photoDataUrl: '',
        monthlyGoal: 0,
        partnerGoal: 0,
        givingLinks: {
          taxDeductibleUrl: '',
          nonTaxDeductibleUrl: '',
        },
      },
      contacts: [], // {id, fullName, phone, email, category, status, monthlyAmount, notes}
      posts: [], // {id, type, locationName, locationCoords, body, createdAt}
      prayerRequests: [], // {id, body, createdAt, fromSupporterName, anonymous}
      pipeline: [], // future: pipeline items
      tasks: [], // {id, text, done}
    },
    supporter: {
      profile: {
        name: '',
        email: '',
        phone: '',
        notifications: {
          inApp: true,
          email: false,
          text: false,
          prayer: true,
        },
      },
      // supporter feed is derived from missionary.posts for now
      prayerWall: [], // {id, body, createdAt, anonymous, prayedCount}
    },
  };
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function AppStateProvider({ children }) {
  const [state, setState] = useState(() => createEmptyState());

  const actions = useMemo(() => {
    return {
      resetAll() {
        setState(createEmptyState());
      },

      updateMissionaryProfile(patch) {
        setState((s) => ({
          ...s,
          missionary: {
            ...s.missionary,
            profile: { ...s.missionary.profile, ...patch },
          },
        }));
      },

      addContact(contact) {
        const newContact = {
          id: uid('contact'),
          fullName: contact.fullName?.trim() ?? '',
          phone: contact.phone?.trim() ?? '',
          email: contact.email?.trim() ?? '',
          category: contact.category === 'warm' ? 'potential_partner' : contact.category ?? 'potential_partner',
          status: contact.status ?? 'prospect',
          monthlyAmount: Number.isFinite(Number(contact.monthlyAmount)) ? Number(contact.monthlyAmount) : 0,
          notes: contact.notes?.trim() ?? '',
        };
        setState((s) => ({
          ...s,
          missionary: { ...s.missionary, contacts: [...s.missionary.contacts, newContact] },
        }));
      },

      addPost(post) {
        const newPost = {
          id: uid('post'),
          type: post.type ?? 'Field story',
          locationName: post.locationName?.trim() ?? '',
          locationCoords: post.locationCoords ?? null,
          body: post.body?.trim() ?? '',
          createdAt: new Date().toISOString(),
        };
        setState((s) => ({
          ...s,
          missionary: { ...s.missionary, posts: [newPost, ...s.missionary.posts] },
        }));
      },

      addTask(text) {
        const t = (text ?? '').trim();
        if (!t) return;
        const newTask = { id: uid('task'), text: t, done: false };
        setState((s) => ({
          ...s,
          missionary: { ...s.missionary, tasks: [newTask, ...s.missionary.tasks] },
        }));
      },

      toggleTask(id) {
        setState((s) => ({
          ...s,
          missionary: {
            ...s.missionary,
            tasks: s.missionary.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
          },
        }));
      },

      deleteTask(id) {
        setState((s) => ({
          ...s,
          missionary: { ...s.missionary, tasks: s.missionary.tasks.filter((t) => t.id !== id) },
        }));
      },

      submitSupporterPrayerRequest({ body, anonymous }) {
        const b = (body ?? '').trim();
        if (!b) return;
        const req = {
          id: uid('prayer'),
          body: b,
          anonymous: Boolean(anonymous),
          createdAt: new Date().toISOString(),
          prayedCount: 0,
        };
        setState((s) => ({
          ...s,
          supporter: { ...s.supporter, prayerWall: [req, ...s.supporter.prayerWall] },
          missionary: { ...s.missionary, prayerRequests: [req, ...s.missionary.prayerRequests] },
        }));
      },

      prayForRequest(id) {
        setState((s) => ({
          ...s,
          supporter: {
            ...s.supporter,
            prayerWall: s.supporter.prayerWall.map((r) =>
              r.id === id ? { ...r, prayedCount: (r.prayedCount ?? 0) + 1 } : r,
            ),
          },
          missionary: {
            ...s.missionary,
            prayerRequests: s.missionary.prayerRequests.map((r) =>
              r.id === id ? { ...r, prayedCount: (r.prayedCount ?? 0) + 1 } : r,
            ),
          },
        }));
      },

      updateSupporterProfile(patch) {
        setState((s) => ({
          ...s,
          supporter: { ...s.supporter, profile: { ...s.supporter.profile, ...patch } },
        }));
      },

      updateSupporterNotifications(patch) {
        setState((s) => ({
          ...s,
          supporter: {
            ...s.supporter,
            profile: {
              ...s.supporter.profile,
              notifications: { ...s.supporter.profile.notifications, ...patch },
            },
          },
        }));
      },
    };
  }, []);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

