import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSignature, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { BAA_AGREEMENT_TEXT, BAA_AGREEMENT_TITLE, CURRENT_BAA_VERSION } from "../../constants/baaAgreement";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

const normalizeName = (value = "") => String(value).trim().replace(/\s+/g, " ");
const BAA_AGREEMENT_PDF_URL = `${process.env.PUBLIC_URL || ""}/baa_agreement.pdf`;

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function BaaAgreementModal({
  user,
  open = true,
  onSigned,
  onSubmit,
  mode = "modal",
  isSubmitting = false,
  submitLabel = "I Agree / Continue",
}) {
  const pdfPaneRef = useRef(null);
  const [signatureName, setSignatureName] = useState("");
  const [manualSignature, setManualSignature] = useState("");
  const [error, setError] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [pdfWidth, setPdfWidth] = useState(640);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const isInline = mode === "inline";

  const expectedName = useMemo(
    () => normalizeName(user?.fullName || user?.name || user?.doctor_name || ""),
    [user]
  );
  const normalizedSignature = normalizeName(signatureName);
  const canSubmit =
    hasScrolledToEnd &&
    normalizedSignature.length >= 2 &&
    (!expectedName || normalizedSignature.toLowerCase() === expectedName.toLowerCase());

  const updateReviewProgress = () => {
    const element = pdfPaneRef.current;
    if (!element) return;

    const scrollBottom = element.scrollTop + element.clientHeight;
    if (scrollBottom >= element.scrollHeight - 16) {
      setHasScrolledToEnd(true);
    }
  };

  useEffect(() => {
    if (open) {
      setSignatureName("");
      setManualSignature("");
      setError("");
      setPdfError("");
      setNumPages(null);
      setHasScrolledToEnd(false);
      if (pdfPaneRef.current) pdfPaneRef.current.scrollTop = 0;
    }
  }, [open]);

  useEffect(() => {
    const element = pdfPaneRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      setPdfWidth(Math.max(280, Math.min(element.clientWidth - 32, 760)));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isInline]);

  const handleDocumentLoadSuccess = ({ numPages: loadedPages }) => {
    setNumPages(loadedPages);
    setPdfError("");
    setHasScrolledToEnd(false);
    if (pdfPaneRef.current) pdfPaneRef.current.scrollTop = 0;
    requestAnimationFrame(updateReviewProgress);
  };

  const handleDocumentLoadError = () => {
    setPdfError("Unable to render the agreement PDF here.");
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();

    if (!hasScrolledToEnd) {
      setError("Please scroll to the end of the agreement before signing.");
      return;
    }

    if (!normalizedSignature) {
      setError("Enter your full legal name to sign.");
      return;
    }

    if (expectedName && normalizedSignature.toLowerCase() !== expectedName.toLowerCase()) {
      setError(`Signature must match your registered name: ${expectedName}.`);
      return;
    }

    setError("");
    const payload = {
      signerName: normalizedSignature,
      manualSignature: manualSignature.trim(),
      baaVersion: CURRENT_BAA_VERSION,
      agreementTitle: BAA_AGREEMENT_TITLE,
      agreementText: BAA_AGREEMENT_TEXT,
    };

    if (onSubmit) {
      await onSubmit(payload);
      return;
    }

    onSigned?.(payload);
  };

  if (!open) return null;

  const content = (
    <div
      className={
        isInline
          ? "w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
          : "flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      }
    >
      <div className={isInline ? "border-b border-slate-200 px-4 py-3 sm:px-5" : "border-b border-slate-200 px-5 py-4 sm:px-6"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-md bg-blue-50 p-2 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className={isInline ? "text-base font-semibold text-slate-950" : "text-lg font-semibold text-slate-950"}>
                {BAA_AGREEMENT_TITLE}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                Review the agreement, then sign with your legal name.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            {CURRENT_BAA_VERSION}
          </div>
        </div>
      </div>

      <div className={isInline ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]" : "grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]"}>
        <div
          ref={pdfPaneRef}
          onScroll={updateReviewProgress}
          className={
            isInline
              ? "h-[420px] min-h-[320px] overflow-y-auto border-b border-slate-200 bg-slate-100 px-4 py-5 lg:border-b-0 lg:border-r"
              : "h-[64vh] min-h-[420px] max-h-[640px] overflow-y-auto border-b border-slate-200 bg-slate-100 px-4 py-5 lg:border-b-0 lg:border-r"
          }
        >
          <Document
            file={BAA_AGREEMENT_PDF_URL}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-600">
                Rendering agreement...
              </div>
            }
            error={
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {pdfError || "Unable to render the agreement PDF here."}{" "}
                <a className="font-medium underline" href={BAA_AGREEMENT_PDF_URL} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              </div>
            }
            className="mx-auto flex w-full flex-col items-center gap-5"
          >
            {Array.from(new Array(numPages || 0), (_, index) => (
              <div key={`baa-page-${index + 1}`} className="overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-slate-200">
                <Page
                  pageNumber={index + 1}
                  width={pdfWidth}
                  loading={
                    <div className="flex h-80 items-center justify-center text-sm text-slate-500">
                      Rendering page {index + 1}...
                    </div>
                  }
                />
              </div>
            ))}
          </Document>
        </div>

        <div className={isInline ? "space-y-3 p-4 sm:p-5" : "space-y-4 overflow-y-auto p-5 sm:p-6"}>
          <div className={hasScrolledToEnd ? "rounded-md border border-emerald-200 bg-emerald-50 p-3" : "rounded-md border border-blue-100 bg-blue-50 p-3"}>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              {hasScrolledToEnd ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <LockKeyhole className="h-4 w-4 text-blue-600" />
              )}
              {hasScrolledToEnd ? "Agreement reviewed" : numPages ? `Scroll through agreement (${numPages} pages)` : "Rendering agreement"}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {hasScrolledToEnd
                ? "Signature fields are unlocked. Complete them to continue registration."
                : "Reach the bottom of the PDF to unlock the signature fields."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baa-signature-name">Full legal name</Label>
            <Input
              id="baa-signature-name"
              value={signatureName}
              onChange={(event) => setSignatureName(event.target.value)}
              disabled={!hasScrolledToEnd || isSubmitting}
              placeholder={expectedName || "Enter full legal name"}
              autoComplete="name"
            />
            {expectedName && (
              <p className="text-xs text-slate-500">Must match {expectedName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="baa-manual-signature">Manual signature note</Label>
            <Textarea
              id="baa-manual-signature"
              value={manualSignature}
              onChange={(event) => setManualSignature(event.target.value)}
              disabled={!hasScrolledToEnd || isSubmitting}
              placeholder="Optional title or signer note"
              className={isInline ? "min-h-[78px]" : "min-h-[96px]"}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="w-full bg-blue-600 text-white hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FileSignature className="mr-2 h-4 w-4" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  if (mode === "inline") {
    return content;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 sm:p-6">
      {content}
    </div>
  );
}
