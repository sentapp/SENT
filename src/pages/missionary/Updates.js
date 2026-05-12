import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { useMissionaryMapPoints } from '../../hooks/useMissionaryMapPoints';
import MapView from '../../components/MapView';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { postTypeBadgeClass, postTypePostCardClass } from '../../lib/postTypeStyles';
import { Button, Card, EmptyState, Input, Label, Modal, Textarea } from '../../components/ui';

const POST_TYPES = ['Field story 🔥', 'Prayer 🙏', 'Monthly update 📊', 'Win ✨'];

function TypeBadge({ children, typeKeyClass }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeKeyClass}`}>{children}</span>
  );
}

function PostActionsMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className="rounded-btn px-2 py-1 text-lg leading-none text-neutral-600 hover:bg-neutral-100"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Post options"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-btn border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-neutral-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit post
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete post
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function MissionaryUpdates() {
  const { user, profile } = useAuth();
  const mid = user?.id;
  const { posts, loading, addPost, updatePost, deletePost } = useMissionaryPosts(mid);
  const mapPoints = useMissionaryMapPoints(profile, posts);

  const displayName = (profile?.full_name || '').trim() || 'You';
  const photoUrl = profile?.photo_url || '';
  const avatarInitials = initialsFromDisplayName(displayName);

  const [type, setType] = useState(POST_TYPES[0]);
  const [locationName, setLocationName] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [locationWarning, setLocationWarning] = useState('');

  const [editingPost, setEditingPost] = useState(null);
  const [editType, setEditType] = useState(POST_TYPES[0]);
  const [editLocation, setEditLocation] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [deletingPost, setDeletingPost] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [flashSuccess, setFlashSuccess] = useState('');

  const recent = useMemo(() => posts, [posts]);

  const canPost = body.trim().length > 0;
  const canSaveEdit = editBody.trim().length > 0;

  useEffect(() => {
    if (!flashSuccess) return;
    const t = setTimeout(() => setFlashSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [flashSuccess]);

  const submitPost = async () => {
    setPostError('');
    setLocationWarning('');
    setPosting(true);
    try {
      const res = await addPost({
        typeUi: type,
        locationName,
        body,
      });
      if (!res.ok) {
        setPostError(res.error || 'Could not publish.');
        setPosting(false);
        return;
      }
      if (res.locationWarning) {
        setLocationWarning(
          `We couldn't place "${locationName.trim()}" on the map. Try a broader place name (e.g. city and country). Your post was still published.`,
        );
      }
      setBody('');
      setLocationName('');
      setType(POST_TYPES[0]);
    } catch (e) {
      setPostError(e?.message || 'Could not publish.');
    } finally {
      setPosting(false);
    }
  };

  const openEdit = (p) => {
    setEditingPost(p);
    setEditType(p.type);
    setEditLocation(p.locationName || '');
    setEditBody(p.body || '');
    setEditError('');
  };

  const closeEdit = () => {
    setEditingPost(null);
    setEditSaving(false);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingPost || !canSaveEdit) return;
    setEditError('');
    setEditSaving(true);
    try {
      const res = await updatePost(
        editingPost.id,
        { typeUi: editType, locationName: editLocation, body: editBody },
        editingPost,
      );
      if (!res.ok) {
        setEditError(res.error || 'Could not save changes.');
        return;
      }
      if (res.locationWarning) {
        setLocationWarning(
          `We couldn't place "${editLocation.trim()}" on the map. Try a broader place name (e.g. city and country). Your post was still saved.`,
        );
      }
      closeEdit();
    } catch (e) {
      setEditError(e?.message || 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingPost) return;
    setDeleteBusy(true);
    try {
      const res = await deletePost(deletingPost.id);
      if (!res.ok) {
        setFlashSuccess('');
        setPostError(res.error || 'Could not delete post.');
        setDeletingPost(null);
        return;
      }
      setDeletingPost(null);
      setFlashSuccess('Post deleted');
    } catch (e) {
      setPostError(e?.message || 'Could not delete post.');
      setDeletingPost(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="sent-page-title">Updates</h1>
        <p className="sent-body text-mission-muted">
          Post stories for supporters, manage recent posts, and view your mission map — all on this page.
        </p>
      </header>

      {flashSuccess ? (
        <p className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{flashSuccess}</p>
      ) : null}

      {postError ? (
        <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{postError}</p>
      ) : null}

      {locationWarning ? (
        <p className="rounded-btn border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#854F0B]">{locationWarning}</p>
      ) : null}

      <Card className="overflow-hidden p-6 md:p-8">
        <p className="sent-page-title">Post an update</p>
        <p className="sent-caption mt-2">Share what God is doing with your send team.</p>

        <div className="mt-8">
          <p className="sent-section-label mb-3">Post type</p>
          <div className="flex flex-wrap gap-2">
            {POST_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`inline-flex h-9 max-w-full items-center justify-center rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
                  type === t
                    ? 'bg-mission-ink text-white'
                    : 'border border-mission-line bg-white text-mission-muted hover:border-mission-muted/50'
                }`}
              >
                <span className="truncate">{t}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <p className="sent-section-label mb-3">Location (optional)</p>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base" aria-hidden>
              📍
            </span>
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Dublin, Ireland"
              className="py-3.5 pl-11"
            />
          </div>
        </div>

        <div className="relative mt-8">
          <p className="sent-section-label mb-3">Post</p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share what God is doing..."
            rows={5}
            className="min-h-[120px] resize-none pb-10"
          />
          <span className="pointer-events-none absolute bottom-3 right-4 text-[13px] text-mission-muted">{body.length}</span>
        </div>

        <div className="mt-8">
          <Button
            type="button"
            variant="primary"
            className="h-12 w-full text-[15px] font-medium"
            disabled={!canPost || posting}
            onClick={submitPost}
          >
            {posting ? 'Posting…' : 'Post to supporters →'}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <p className="sent-section-title text-ink">Recent posts</p>
        {loading ? (
          <p className="sent-body text-mission-muted">Loading posts…</p>
        ) : recent.length === 0 ? (
          <EmptyState
            icon="globe"
            title="Share what God is doing"
            subtitle="Field stories, prayer requests, monthly updates, and wins help your send team stay with you."
          />
        ) : (
          <div className="space-y-4">
            {recent.map((p) => (
              <Card
                key={p.id}
                id={`post-${p.id}`}
                className={`relative scroll-mt-4 overflow-hidden p-5 ${postTypePostCardClass(p.type)}`}
              >
                <div className="absolute left-5 top-5 z-10">
                  <TypeBadge typeKeyClass={postTypeBadgeClass(p.type)}>{p.type}</TypeBadge>
                </div>
                <div className="absolute right-3 top-4 z-10">
                  <PostActionsMenu onEdit={() => openEdit(p)} onDelete={() => setDeletingPost(p)} />
                </div>
                <div className="flex items-start gap-3 pt-10">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-mission-line bg-white">
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-mission-blue text-xs font-semibold text-white">
                        {avatarInitials.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pr-8">
                    <p className="sent-caption">{new Date(p.createdAt).toLocaleString()}</p>
                    {p.locationName ? (
                      <p className="sent-body mt-2 font-medium text-mission-ink">
                        <span className="mr-1" aria-hidden>
                          📍
                        </span>
                        {p.locationName}
                      </p>
                    ) : null}
                    <p className="sent-body mt-3 whitespace-pre-wrap text-mission-ink">{p.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <section className="space-y-3" aria-labelledby="mission-map-heading">
        <div className="space-y-1">
          <h2 id="mission-map-heading" className="sent-section-title text-ink">
            Mission map
          </h2>
          <p className="sent-body text-mission-muted">
            Your home base and update locations (from plain-text places on posts). Pins connect in chronological order.
          </p>
        </div>
        <MapView points={mapPoints} height={380} />
        <Card className="p-5">
          <p className="sent-section-title">How pins work</p>
          <p className="sent-body mt-2 text-mission-muted">
            Set your home location as text in Settings. When you post an update with a location, we place a pin automatically — no coordinates needed.
          </p>
        </Card>
      </section>

      <Modal
        open={Boolean(editingPost)}
        title="Edit post"
        onClose={closeEdit}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="button" variant="accent" disabled={!canSaveEdit || editSaving} onClick={saveEdit}>
              {editSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      >
        {editError ? <p className="mb-3 text-sm text-red-700">{editError}</p> : null}
        <p className="sent-section-label mb-3">Post type</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {POST_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEditType(t)}
              className={`inline-flex h-9 max-w-full items-center justify-center rounded-full px-3 text-xs font-medium transition-colors duration-200 md:text-sm ${
                editType === t
                  ? 'bg-mission-ink text-white'
                  : 'border border-mission-line bg-white text-mission-muted hover:border-mission-muted/50'
              }`}
            >
              <span className="truncate">{t}</span>
            </button>
          ))}
        </div>
        <p className="sent-section-label mb-3">Location (optional)</p>
        <div className="relative mb-4">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base" aria-hidden>
            📍
          </span>
          <Input
            value={editLocation}
            onChange={(e) => setEditLocation(e.target.value)}
            placeholder="e.g. Dublin, Ireland"
            className="py-3 pl-11"
          />
        </div>
        <Label title="Post">
          <Textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            placeholder="Share what God is doing..."
            rows={6}
          />
        </Label>
      </Modal>

      <Modal
        open={Boolean(deletingPost)}
        title="Delete post?"
        onClose={() => {
          if (deleteBusy) return;
          setDeletingPost(null);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeletingPost(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-700">Are you sure you want to delete this post? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
