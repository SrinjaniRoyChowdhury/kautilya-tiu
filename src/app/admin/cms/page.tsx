import type { Metadata } from "next";
import Link from "next/link";
import { deleteAnnouncementAction, deleteGalleryAlbumAction, deleteGalleryImageAction } from "@/app/actions/cms";
import {
  ConferenceDocForm,
  PublishedDocs,
} from "@/components/admin/conference-doc-forms";
import {
  AnnouncementsTable,
  CreateAnnouncementModalButton,
  GalleryAlbumForm,
  GalleryImageForm,
  SiteSettingsForm,
} from "@/components/admin/cms-forms";
import { Button } from "@/components/ui/button";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission, getRoleNames } from "@/lib/auth";
import { isLimitedStaff } from "@/lib/staff-access";
import {
  getAllEditionsAdmin,
  getAnnouncementsAdmin,
  getGalleryAlbums,
  getSiteSettings,
  getConferenceDocuments,
} from "@/lib/data";

export const metadata: Metadata = { title: "CMS" };

export default async function AdminCmsPage() {
  const roles = await getRoleNames();
  const canEdit = await hasPermission("cms.manage");
  const readOnly = !canEdit;
  if (!canEdit && !isLimitedStaff(roles)) {
    return (
      <Container className="py-12">
        <PageHeader
          eyebrow="Staff"
          title="Content"
          description="You need cms.manage to edit public pages."
        />
      </Container>
    );
  }

  const [settings, editions, announcements, albums, docs, canManageDocs] = await Promise.all([
    getSiteSettings(),
    getAllEditionsAdmin(),
    getAnnouncementsAdmin(),
    getGalleryAlbums(false),
    getConferenceDocuments(),
    hasPermission("edition.manage"),
  ]);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Staff"
        title="Content"
        description="Changes go live on the public site without a deploy. Paste plain text only — HTML tags are stripped."
      />

      {canManageDocs ? (
        <Card>
          <p className="mb-2 font-serif text-2xl text-gold-700">Rulebook and guidelines</p>
          <p className="mb-6 text-sm text-ink-muted">
            Public PDFs at /rulebook. Delegates must acknowledge both before they can register.
          </p>
          <ConferenceDocForm />
          <PublishedDocs docs={docs} />
        </Card>
      ) : null}

      <Card className={canManageDocs ? "mt-6" : undefined}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-2xl text-gold-700">Site copy</p>
            <p className="mt-1 text-sm text-ink-muted">
              Homepage hero, about, mission, history, and contact.
              {canEdit && !readOnly ? (
                <>
                  {" "}
                  Edit team on{" "}
                  <Link href="/admin/team" className="text-gold-700 hover:underline">
                    Team
                  </Link>
                  .
                </>
              ) : null}
            </p>
          </div>
        </div>
        {readOnly ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Society</dt>
              <dd>{settings.society_name}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Tagline</dt>
              <dd>{settings.tagline || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">Contact</dt>
              <dd>{settings.contact_email || "—"}</dd>
            </div>
          </dl>
        ) : (
          <SiteSettingsForm settings={settings} />
        )}
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-2xl text-gold-700">Sponsors & collaborators</p>
            <p className="mt-1 text-sm text-ink-muted">
              Homepage partner logos with name and category.
              {canEdit && !readOnly ? (
                <>
                  {" "}
                  Manage on{" "}
                  <Link href="/admin/partners" className="text-gold-700 hover:underline">
                    Sponsors & collaborators
                  </Link>
                  .
                </>
              ) : null}
            </p>
          </div>
          {canEdit && !readOnly ? (
            <Link href="/admin/partners">
              <Button variant="secondary" size="sm">
                Manage
              </Button>
            </Link>
          ) : null}
        </div>
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-serif text-2xl text-gold-700">Announcements</p>
          {!readOnly ? <CreateAnnouncementModalButton editions={editions} /> : null}
        </div>
        <AnnouncementsTable
          announcements={announcements}
          editions={editions}
          readOnly={readOnly}
          onDelete={deleteAnnouncementAction}
        />
      </Card>

      <Card className="mt-6">
        <p className="mb-2 font-serif text-2xl text-gold-700">Gallery</p>
        {readOnly ? (
          <ul className="grid gap-2 text-sm">
            {albums.map((album) => (
              <li key={album.id}>{album.title}</li>
            ))}
            {albums.length ? null : <li className="text-ink-muted">No albums.</li>}
          </ul>
        ) : (
          <>
            <p className="mb-6 text-sm text-ink-muted">
              Albums need an edition. Add images as public URLs — no paid storage pipeline.
            </p>
            {editions.length ? <GalleryAlbumForm editions={editions} /> : (
              <p className="text-sm text-ink-muted">Create an edition before adding albums.</p>
            )}
            <div className="mt-8 space-y-8">
              {albums.map((album) => (
                <div key={album.id} className="border-t border-gold-700/15 pt-6">
                  <GalleryAlbumForm editions={editions} album={album} />
                  <form action={deleteGalleryAlbumAction} className="mt-2">
                    <input type="hidden" name="id" value={album.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Delete album
                    </Button>
                  </form>
                  <ul className="mt-3 space-y-2 text-sm">
                    {(album.images ?? []).map((image) => (
                      <li key={image.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="truncate text-ink-muted">{image.caption || image.storage_key}</span>
                        <form action={deleteGalleryImageAction}>
                          <input type="hidden" name="id" value={image.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Remove
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <GalleryImageForm albumId={album.id} />
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </Container>
  );
}
