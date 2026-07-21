import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { supabase } from '../../lib/supabaseClient';
import { useMissionaryMapPoints } from '../../hooks/useMissionaryMapPoints';
import MapView from '../../components/MapView';
import { postTypeBadgeClass, postTypePostCardClass } from '../../lib/postTypeStyles';
import { Button, Card, EmptyState, Input, Label, Modal, Textarea } from '../../components/ui';
import DarkPageHeader from '../../components/DarkPageHeader';
import MissionaryPageShell from '../../components/MissionaryPageShell';
import ReactionButton from '../../components/ReactionButton';

const POST_TYPES = ['Field story 🔥', 'Prayer 🙏', 'Monthly update 📊', 'Win ✨'];
const FIELD_CATEGORIES = [
  'Universities',
  'High Schools',
  'Nations',
  'Cities',
  'Church Planting',
  'Unreached People Groups',
  'Marketplace',
  'Arts & Entertainment',
];

function FieldCategoryChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0' }}>
      {FIELD_CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(value === cat ? null : cat)}
          style={{
            padding: '5px 14px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            border: '0.5px solid',
            background: value === cat ? '#111' : 'white',
            color: value === cat ? 'white' : '#666',
            borderColor: value === cat ? '#111' : '#DDD',
          }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

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
        className="rounded-btn px-2 py-1 text-lg leading-none text-white/70 hover:bg-white/10"
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

  const [type, setType] = useState(POST_TYPES[0]);
  const [locationName, setLocationName] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [shareToCommunity, setShareToCommunity] = useState(false);
  const [fieldCategory, setFieldCategory] = useState(null);
  const fileInputRef = useRef(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [locationWarning, setLocationWarning] = useState('');

  const [editingPost, setEditingPost] = useState(null);
  const [editType, setEditType] = useState(POST_TYPES[0]);
  const [editLocation, setEditLocation] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editFieldCategory, setEditFieldCategory] = useState(null);
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

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(file) {
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('post-images').upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from('post-images').getPublicUrl(path);
    return data.publicUrl;
  }

  const handlePost = async () => {
    setPostError('');
    setLocationWarning('');
    setPosting(true);
    try {
      const imageUrl = image ? await uploadImage(image) : null;
      const res = await addPost({
        typeUi: type,
        locationName,
        body,
        imageUrl,
        shareToCommunity,
        fieldCategory: shareToCommunity ? fieldCategory : null,
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
      setImage(null);
      setImagePreview(null);
      setShareToCommunity(false);
      setFieldCategory(null);
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
    setEditFieldCategory(p.fieldCategory || null);
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
        {
          typeUi: editType,
          locationName: editLocation,
          body: editBody,
          fieldCategory: editFieldCategory,
        },
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
    <MissionaryPageShell
      header={<DarkPageHeader title="Updates" subtitle="Stories for your send team" />}
    >
    <div className="space-y-6 pb-5 md:pb-8">
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

        {imagePreview ? (
          <div className="relative mt-3">
            <img
              src={imagePreview}
              alt=""
              className="block w-full max-h-[200px] rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setImagePreview(null);
              }}
              className="absolute right-2 top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-none bg-black/60 text-sm text-white"
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#EEE] bg-transparent px-3 py-1.5 text-[13px] text-[#888]"
          >
            📷 Add photo
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#666]">
            <span>Share to Community</span>
            <button
              type="button"
              role="switch"
              aria-checked={shareToCommunity}
              onClick={() => setShareToCommunity((s) => !s)}
              className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
                shareToCommunity ? 'bg-accent' : 'bg-[#DDD]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] duration-200 ${
                  shareToCommunity ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>
        </div>
        {shareToCommunity ? (
          <div className="mt-3">
            <p className="sent-section-label mb-1">Field category</p>
            <FieldCategoryChips value={fieldCategory} onChange={setFieldCategory} />
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />

        <div className="mt-8">
          <Button
            type="button"
            variant="primary"
            className="h-12 w-full text-[15px] font-medium"
            disabled={!canPost || posting}
            onClick={handlePost}
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
              <article
                key={p.id}
                id={`post-${p.id}`}
                className={`relative scroll-mt-4 overflow-hidden rounded-card border border-[#333] bg-[#111] ${postTypePostCardClass(p.type)}`}
              >
                <div className="relative min-h-[100px] bg-[#1A1A1A] px-4 pb-4 pt-12">
                  <div className="absolute left-4 top-4 z-10">
                    <TypeBadge typeKeyClass={postTypeBadgeClass(p.type)}>{p.type}</TypeBadge>
                  </div>
                  <div className="absolute right-2 top-3 z-10">
                    <PostActionsMenu onEdit={() => openEdit(p)} onDelete={() => setDeletingPost(p)} />
                  </div>
                  <p className="text-[11px] text-white/45">{new Date(p.createdAt).toLocaleString()}</p>
                  {p.locationName ? (
                    <p className="mt-2 text-sm font-medium text-white/70">
                      <span className="mr-1" aria-hidden>
                        📍
                      </span>
                      {p.locationName}
                    </p>
                  ) : null}
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-white">{p.body}</p>
                </div>
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="block max-h-[280px] w-full object-cover"
                  />
                ) : null}
                <div className="flex flex-wrap items-center gap-2 border-t border-[#333] px-4 py-3">
                  <ReactionButton active={false} label="Pray" emoji="🙏" disabled onClick={() => {}} />
                  <ReactionButton active={false} label="Celebrate" emoji="🎉" disabled onClick={() => {}} />
                </div>
              </article>
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
        <p className="sent-section-label mb-1">Field category</p>
        <div className="mb-4">
          <FieldCategoryChips value={editFieldCategory} onChange={setEditFieldCategory} />
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
    </MissionaryPageShell>
  );
}
