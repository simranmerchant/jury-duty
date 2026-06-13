const PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

export function walrusBlobUrl(blobId: string): string {
  return `${AGGREGATOR}/v1/blobs/${blobId}`;
}

export async function uploadToWalrus(buffer: Buffer, contentType: string): Promise<string> {
  const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=5`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Walrus upload failed: ${text}`);
  }

  const data = await res.json();
  // Response is either { newlyCreated: { blobObject: { blobId } } } or { alreadyCertified: { blobId } }
  const blobId: string =
    data?.newlyCreated?.blobObject?.blobId ??
    data?.alreadyCertified?.blobId;

  if (!blobId) throw new Error("Walrus did not return a blob ID");
  return walrusBlobUrl(blobId);
}
