"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addGalleryImageAction,
  saveAnnouncementAction,
  saveGalleryAlbumAction,
  updateSiteSettingsAction,
  type FormState,
} from "@/app/actions/cms";
import { AdminTable } from "@/components/admin/admin-filters";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, ModalTrigger } from "@/components/ui/modal";
import { toPlainText } from "@/lib/sanitize";
import type { Announcement, Edition, GalleryAlbum, SiteSettings } from "@/types";

function Feedback({ state }: { state: FormState }) {
  return <ActionFeedback error={state.error} success={state.success} />;
}

export function SiteSettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, {} as FormState);
  const stats = settings.hero_stats ?? [];

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Society name" htmlFor="society_name">
        <Input id="society_name" name="society_name" required defaultValue={settings.society_name} />
      </Field>
      <Field label="Tagline" htmlFor="tagline">
        <Input id="tagline" name="tagline" defaultValue={settings.tagline ?? ""} />
      </Field>
      <Field label="About" htmlFor="about_html" hint="Plain text. Line breaks are kept.">
        <Textarea id="about_html" name="about_html" defaultValue={toPlainText(settings.about_html)} />
      </Field>
      <Field label="Mission" htmlFor="mission_html" hint="Plain text. Line breaks are kept.">
        <Textarea id="mission_html" name="mission_html" defaultValue={toPlainText(settings.mission_html)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="History" htmlFor="history_html" hint="Plain text. Line breaks are kept.">
          <Textarea id="history_html" name="history_html" defaultValue={toPlainText(settings.history_html)} />
        </Field>
      </div>
      <Field label="Contact email" htmlFor="contact_email">
        <Input id="contact_email" name="contact_email" type="email" defaultValue={settings.contact_email ?? ""} />
      </Field>
      <Field label="Contact phone" htmlFor="contact_phone">
        <Input id="contact_phone" name="contact_phone" defaultValue={settings.contact_phone ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address" htmlFor="contact_address">
          <Input id="contact_address" name="contact_address" defaultValue={settings.contact_address ?? ""} />
        </Field>
      </div>
      <Field label="Instagram URL" htmlFor="instagram_url">
        <Input id="instagram_url" name="instagram_url" defaultValue={settings.instagram_url ?? ""} />
      </Field>
      <Field label="LinkedIn URL" htmlFor="linkedin_url">
        <Input id="linkedin_url" name="linkedin_url" defaultValue={settings.linkedin_url ?? ""} />
      </Field>
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
          <Field label={`Hero stat ${index + 1} label`} htmlFor={`stat_label_${index + 1}`}>
            <Input
              id={`stat_label_${index + 1}`}
              name={`stat_label_${index + 1}`}
              defaultValue={stats[index]?.label ?? ""}
            />
          </Field>
          <Field label={`Hero stat ${index + 1} value`} htmlFor={`stat_value_${index + 1}`}>
            <Input
              id={`stat_value_${index + 1}`}
              name={`stat_value_${index + 1}`}
              defaultValue={stats[index]?.value ?? ""}
            />
          </Field>
        </div>
      ))}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save site copy"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

function EditionOptions({ editions }: { editions: Edition[] }) {
  return (
    <>
      <option value="">All editions (global)</option>
      {editions.map((edition) => (
        <option key={edition.id} value={edition.id}>
          {edition.name}
        </option>
      ))}
    </>
  );
}

export function AnnouncementForm({
  editions,
  announcement,
  onSuccess,
}: {
  editions: Edition[];
  announcement?: Announcement;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveAnnouncementAction, {} as FormState);

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="grid gap-3">
      {announcement ? <input type="hidden" name="id" value={announcement.id} /> : null}
      <Field label="Title" htmlFor={`ann-title-${announcement?.id ?? "new"}`}>
        <Input
          id={`ann-title-${announcement?.id ?? "new"}`}
          name="title"
          required
          defaultValue={announcement?.title}
        />
      </Field>
      <Field label="Body" htmlFor={`ann-body-${announcement?.id ?? "new"}`} hint="Plain text. Line breaks are kept.">
        <Textarea
          id={`ann-body-${announcement?.id ?? "new"}`}
          name="body_html"
          required
          defaultValue={toPlainText(announcement?.body_html)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Edition" htmlFor={`ann-edition-${announcement?.id ?? "new"}`}>
          <Select
            id={`ann-edition-${announcement?.id ?? "new"}`}
            name="edition_id"
            defaultValue={announcement?.edition_id ?? ""}
          >
            <EditionOptions editions={editions} />
          </Select>
        </Field>
        <Field label="Order" htmlFor={`ann-order-${announcement?.id ?? "new"}`}>
          <Input
            id={`ann-order-${announcement?.id ?? "new"}`}
            name="display_order"
            type="number"
            defaultValue={announcement?.display_order ?? 0}
          />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="published" defaultChecked={announcement?.published ?? false} />
          Published
        </label>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : announcement ? "Update notice" : "Add notice"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function CreateAnnouncementModalButton({ editions }: { editions: Edition[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ModalTrigger label="Add announcement" onOpen={() => setOpen(true)} />
      <Modal open={open} title="Add announcement" onClose={() => setOpen(false)} wide>
        <AnnouncementForm editions={editions} onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  );
}

function EditAnnouncementModal({
  announcement,
  editions,
  onClose,
}: {
  announcement: Announcement;
  editions: Edition[];
  onClose: () => void;
}) {
  return (
    <Modal open title="Edit announcement" onClose={onClose} wide>
      <AnnouncementForm editions={editions} announcement={announcement} onSuccess={onClose} />
    </Modal>
  );
}

export function AnnouncementsTable({
  announcements,
  editions,
  readOnly,
  onDelete,
}: {
  announcements: Announcement[];
  editions: Edition[];
  readOnly: boolean;
  onDelete: (formData: FormData) => void;
}) {
  if (!announcements.length) {
    return <p className="text-sm text-ink-muted">No announcements published yet.</p>;
  }

  const editionName = Object.fromEntries(editions.map((e) => [e.id, e.name]));

  return (
    <AdminTable columns={readOnly ? ["Title", "Edition", "Published"] : ["Title", "Edition", "Order", "Published", ""]}>
      {announcements.map((item) => (
        <AnnouncementRow
          key={item.id}
          item={item}
          editions={editions}
          editionName={editionName}
          readOnly={readOnly}
          onDelete={onDelete}
        />
      ))}
    </AdminTable>
  );
}

function AnnouncementRow({
  item,
  editions,
  editionName,
  readOnly,
  onDelete,
}: {
  item: Announcement;
  editions: Edition[];
  editionName: Record<string, string>;
  readOnly: boolean;
  onDelete: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <tr className="border-b border-gold-700/10 hover:bg-parchment-100">
      <td className="px-2 py-1.5">
        <p className="font-medium">{item.title}</p>
        <p className="line-clamp-1 text-xs text-ink-muted">{toPlainText(item.body_html)}</p>
      </td>
      <td className="px-2 py-1.5 text-sm text-ink-muted">
        {item.edition_id ? editionName[item.edition_id] ?? "Edition" : "All editions"}
      </td>
      {readOnly ? (
        <td className="px-2 py-1.5 text-sm text-ink-muted">{item.published ? "Yes" : "No"}</td>
      ) : (
        <>
          <td className="px-2 py-1.5 text-sm text-ink-muted">{item.display_order}</td>
          <td className="px-2 py-1.5 text-sm text-ink-muted">{item.published ? "Yes" : "No"}</td>
          <td className="px-2 py-1.5 text-right">
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
                Edit
              </Button>
              <form action={onDelete}>
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Delete
                </Button>
              </form>
            </div>
            {open ? (
              <EditAnnouncementModal
                announcement={item}
                editions={editions}
                onClose={() => setOpen(false)}
              />
            ) : null}
          </td>
        </>
      )}
    </tr>
  );
}

export function GalleryAlbumForm({
  editions,
  album,
}: {
  editions: Edition[];
  album?: GalleryAlbum;
}) {
  const [state, formAction, pending] = useActionState(saveGalleryAlbumAction, {} as FormState);
  return (
    <form action={formAction} className="grid gap-3">
      {album ? <input type="hidden" name="id" value={album.id} /> : null}
      <Field label="Title" htmlFor={`album-title-${album?.id ?? "new"}`}>
        <Input
          id={`album-title-${album?.id ?? "new"}`}
          name="title"
          required
          defaultValue={album?.title}
        />
      </Field>
      <Field label="Description" htmlFor={`album-desc-${album?.id ?? "new"}`}>
        <Textarea
          id={`album-desc-${album?.id ?? "new"}`}
          name="description"
          defaultValue={album?.description ?? ""}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Edition" htmlFor={`album-edition-${album?.id ?? "new"}`}>
          <Select
            id={`album-edition-${album?.id ?? "new"}`}
            name="edition_id"
            required
            defaultValue={album?.edition_id ?? editions[0]?.id}
          >
            {editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {edition.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order" htmlFor={`album-order-${album?.id ?? "new"}`}>
          <Input
            id={`album-order-${album?.id ?? "new"}`}
            name="display_order"
            type="number"
            defaultValue={album?.display_order ?? 0}
          />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" name="published" defaultChecked={album?.published ?? false} />
          Published
        </label>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : album ? "Update album" : "Add album"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function GalleryImageForm({ albumId }: { albumId: string }) {
  const [state, formAction, pending] = useActionState(addGalleryImageAction, {} as FormState);
  return (
    <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="album_id" value={albumId} />
      <Field label="Image URL" htmlFor={`img-url-${albumId}`}>
        <Input id={`img-url-${albumId}`} name="storage_key" required placeholder="https://" />
      </Field>
      <Field label="Caption" htmlFor={`img-cap-${albumId}`}>
        <Input id={`img-cap-${albumId}`} name="caption" />
      </Field>
      <div className="flex flex-col items-start justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add image"}
        </Button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
