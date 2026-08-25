import type { Metadata } from "next";
import { Card, Container, PageHeader } from "@/components/ui/card";
import { getGalleryAlbums } from "@/lib/data";

export const metadata: Metadata = { title: "Gallery" };

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export default async function GalleryPage() {
  const albums = await getGalleryAlbums(true);

  return (
    <Container className="py-12">
      <PageHeader
        eyebrow="Archive"
        title="Gallery"
        description="Published albums from past and current editions."
      />
      {albums.length ? (
        <div className="grid gap-10">
          {albums.map((album) => (
            <section key={album.id}>
              <h2 className="font-serif text-2xl text-gold-700">{album.title}</h2>
              {album.description ? (
                <p className="mt-2 max-w-2xl text-sm text-ink-muted">{album.description}</p>
              ) : null}
              {album.images?.length ? (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {album.images.map((image) => (
                    <li key={image.id}>
                      <Card className="p-3">
                        {isHttpUrl(image.storage_key) ? (
                          // CMS URLs are not in next/image remotePatterns.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image.storage_key}
                            alt={image.caption ?? ""}
                            className="h-52 w-full object-cover"
                          />
                        ) : (
                          <p className="text-sm text-ink-muted">Image pending.</p>
                        )}
                        {image.caption ? (
                          <p className="mt-2 text-sm text-ink-muted">{image.caption}</p>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">Photos for this album will appear here.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-ink-muted">No published albums yet.</p>
        </Card>
      )}
    </Container>
  );
}
