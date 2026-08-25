import type { Metadata } from "next";
import { deleteAnnouncementAction, deleteGalleryAlbumAction, deleteGalleryImageAction } from "@/app/actions/cms";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  ConferenceDocForm,
  PublishedDocs,
} from "@/components/admin/conference-doc-forms";
import {
  AnnouncementForm,
  GalleryAlbumForm,
  GalleryImageForm,
  SiteSettingsForm,
} from "@/components/admin/cms-forms";
import { Button } from "@/components/ui/button";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth";
import {
  getAllEditionsAdmin,
  getAnnouncementsAdmin,
  getGalleryAlbums,
  getSiteSettings,
  getConferenceDocuments,
} from "@/lib/data";

export const metadata: Metadata = { title: "CMS" };

export default async function AdminCmsPage() {
  const allowed = await hasPermission("cms.manage");
  if (!allowed) {
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
      <AdminNav current="/admin/cms" />

      {canManageDocs ? (
        <Card>
          <p className="mb-4 font-serif text-2xl text-gold-700">Rulebook and guidelines</p>
          <p className="mb-6 text-sm text-ink-muted">
            Public PDFs at /rulebook. Delegates must acknowledge both before they can register. Only
            an admin can upload or delete these files.
          </p>
          <ConferenceDocForm />
          <PublishedDocs docs={docs} />
        </Card>
      ) : null}

      <Card className={canManageDocs ? "mt-6" : undefined}>
        <p className="mb-4 font-serif text-2xl text-gold-700">Site copy</p>
        <p className="mb-6 text-sm text-ink-muted">
          Homepage hero, about, mission, history, and contact details.
        </p>
        <SiteSettingsForm settings={settings} />
      </Card>

      <Card className="mt-6">
        <p className="mb-4 font-serif text-2xl text-gold-700">Announcements</p>
        <AnnouncementForm editions={editions} />
        <div className="mt-6 grid gap-4">
          {announcements.map((item) => (
            <div key={item.id} className="border-t border-gold-700/15 pt-4">
              <AnnouncementForm editions={editions} announcement={item} />
              <form action={deleteAnnouncementAction} className="mt-2">
                <input type="hidden" name="id" value={item.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Delete
                </Button>
              </form>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <p className="mb-4 font-serif text-2xl text-gold-700">Gallery</p>
        <p className="mb-6 text-sm text-ink-muted">
          Albums need an edition. Add images as public URLs — no paid storage pipeline.
        </p>
        {editions.length ? <GalleryAlbumForm editions={editions} /> : (
          <p className="text-sm text-ink-muted">Create an edition before adding albums.</p>
        )}
        <div className="mt-6 grid gap-6">
          {albums.map((album) => (
            <div key={album.id} className="border-t border-gold-700/15 pt-4">
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
      </Card>
    </Container>
  );
}
