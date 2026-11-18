/** Saves text as a file through a temporary download link. */
export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();

    // Revoking right away can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
