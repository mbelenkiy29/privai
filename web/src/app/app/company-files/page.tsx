"use client";

import { useState, useRef } from "react";
import Text from "@/refresh-components/texts/Text";
import { Card } from "@/refresh-components/cards";
import { Button } from "@opal/components";
import {
  SvgFolder,
  SvgFileText,
  SvgChevronRight,
  SvgChevronDown,
  SvgUploadCloud,
  SvgX,
} from "@opal/icons";
import { Content } from "@opal/layouts";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { toast } from "@/hooks/useToast";

// ─── Types ───

interface CompanyFile {
  file_id: string;
  file_name: string;
  file_size: number | null;
  upload_date: string | null;
}

interface TreeFolder {
  name: string;
  path: string;
  folders: Map<string, TreeFolder>;
  files: CompanyFile[];
}

// ─── Helpers ───

function getFileExtension(title: string): string {
  const parts = title.split(".");
  if (parts.length > 1) return parts.pop()!.toUpperCase();
  return "FILE";
}

function getFileTypeColor(ext: string): string {
  const colors: Record<string, string> = {
    PDF: "bg-status-error-02 text-status-error-05",
    DOC: "bg-action-link-01 text-action-link-05",
    DOCX: "bg-action-link-01 text-action-link-05",
    XLS: "bg-status-success-01 text-status-success-05",
    XLSX: "bg-status-success-01 text-status-success-05",
    PPT: "bg-status-warning-01 text-status-warning-05",
    PPTX: "bg-status-warning-01 text-status-warning-05",
    TXT: "bg-background-neutral-02 text-text-03",
    CSV: "bg-status-success-01 text-status-success-05",
    MD: "bg-background-neutral-02 text-text-03",
    JSON: "bg-background-neutral-02 text-text-03",
    HTML: "bg-status-warning-01 text-status-warning-05",
  };
  return colors[ext] || "bg-background-neutral-02 text-text-03";
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildFolderTree(files: CompanyFile[]): TreeFolder {
  const root: TreeFolder = {
    name: "All Files",
    path: "",
    folders: new Map(),
    files: [],
  };

  for (const file of files) {
    const parts = file.file_name.split("/").filter(Boolean);
    if (parts.length <= 1) {
      root.files.push(file);
    } else {
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const folderName = parts[i]!;
        if (!current.folders.has(folderName)) {
          current.folders.set(folderName, {
            name: folderName,
            path: parts.slice(0, i + 1).join("/"),
            folders: new Map(),
            files: [],
          });
        }
        current = current.folders.get(folderName)!;
      }
      current.files.push({
        ...file,
        file_name: parts[parts.length - 1]!,
      });
    }
  }

  return root;
}

function countAllFiles(folder: TreeFolder): number {
  let count = folder.files.length;
  for (const sub of folder.folders.values()) {
    count += countAllFiles(sub);
  }
  return count;
}

/** Get all subfolders + files for the content pane (immediate children only). */
function getFolderContents(folder: TreeFolder) {
  const subfolders = Array.from(folder.folders.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const files = [...folder.files].sort((a, b) =>
    a.file_name.localeCompare(b.file_name)
  );
  return { subfolders, files };
}

/** Resolve a folder by path string (e.g. "reports/2024"). */
function resolveFolderByPath(
  root: TreeFolder,
  path: string
): TreeFolder | null {
  if (!path) return root;
  const parts = path.split("/").filter(Boolean);
  let current = root;
  for (const part of parts) {
    const next = current.folders.get(part);
    if (!next) return null;
    current = next;
  }
  return current;
}

/** Get breadcrumb segments from a path. */
function getBreadcrumbs(path: string): { name: string; path: string }[] {
  if (!path) return [];
  const parts = path.split("/").filter(Boolean);
  return parts.map((part, i) => ({
    name: part,
    path: parts.slice(0, i + 1).join("/"),
  }));
}

// ─── Upload Zone ───

function CompanyFileUploadZone({
  onUploadComplete,
}: {
  onUploadComplete: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (incoming: FileList | File[]) => {
    setSelectedFiles((prev) => [...prev, ...Array.from(incoming)]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(
        "/api/manage/connector/company-files/upload",
        { method: "POST", body: formData }
      );
      if (response.ok) {
        toast.success(
          `Successfully uploaded ${selectedFiles.length} file(s). They will be indexed shortly.`
        );
        setSelectedFiles([]);
        onUploadComplete();
      } else {
        const errorJson = await response.json();
        toast.error(`Upload failed: ${errorJson.detail || "Unknown error"}`);
      }
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragActive(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-12 border-2 border-dashed cursor-pointer transition-colors",
          dragActive
            ? "border-action-link-05 bg-action-link-01"
            : "border-border-02 hover:border-border-03 hover:bg-background-tint-01"
        )}
      >
        <SvgUploadCloud
          className={cn(
            "w-7 h-7",
            dragActive ? "text-action-link-05" : "text-text-02"
          )}
        />
        <Text mainUiAction text03>
          {dragActive
            ? "Drop files here"
            : "Drag and drop files here, or click to browse"}
        </Text>
        <Text secondaryBody text02>
          PDF, Word, Excel, PowerPoint, text files, and more
        </Text>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <Text mainUiAction text04>
            {selectedFiles.length} file(s) selected
          </Text>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between px-3 py-1.5 rounded-08 bg-background-neutral-01"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SvgFileText className="w-4 h-4 text-text-03 shrink-0" />
                  <Text secondaryBody text04 className="truncate">
                    {file.name}
                  </Text>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-0.5 hover:bg-background-neutral-02 rounded"
                >
                  <SvgX className="w-3.5 h-3.5 text-text-03" />
                </button>
              </div>
            ))}
          </div>
          <Button
            onClick={handleUpload}
            disabled={isUploading}
            prominence="primary"
            icon={SvgUploadCloud}
          >
            {isUploading
              ? "Uploading..."
              : `Upload ${selectedFiles.length} file(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar Folder Tree Node ───

function SidebarFolderNode({
  folder,
  depth,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpand,
}: {
  folder: TreeFolder;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}) {
  const isExpanded = expandedPaths.has(folder.path);
  const isSelected = selectedPath === folder.path;
  const hasChildren = folder.folders.size > 0;
  const sortedSubfolders = Array.from(folder.folders.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const fileCount = countAllFiles(folder);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(folder.path);
          if (hasChildren && !isExpanded) {
            onToggleExpand(folder.path);
          }
        }}
        className={cn(
          "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-08 text-left transition-colors group",
          isSelected
            ? "bg-background-tint-02"
            : "hover:bg-background-tint-01"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(folder.path);
            }}
            className="p-0.5 rounded hover:bg-background-neutral-02 shrink-0"
          >
            {isExpanded ? (
              <SvgChevronDown className="w-3 h-3 text-text-03" />
            ) : (
              <SvgChevronRight className="w-3 h-3 text-text-03" />
            )}
          </button>
        ) : (
          <div className="w-4 shrink-0" />
        )}

        <SvgFolder
          className={cn(
            "w-4 h-4 shrink-0",
            isSelected ? "text-action-link-05" : "text-text-03"
          )}
        />
        <Text
          secondaryBody
          className={cn(
            "truncate flex-1",
            isSelected ? "text-text-05 font-medium" : "text-text-04"
          )}
        >
          {folder.name}
        </Text>
        <Text secondaryBody text02 className="shrink-0 text-xs">
          {fileCount}
        </Text>
      </button>

      {/* Expanded children */}
      {isExpanded && hasChildren && (
        <div>
          {sortedSubfolders.map((sub) => (
            <SidebarFolderNode
              key={sub.path}
              folder={sub}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───

export default function CompanyFilesPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set([""])
  );

  const { data, isLoading, mutate } = useSWR<{ files: CompanyFile[] }>(
    "/api/manage/connector/company-files",
    errorHandlingFetcher
  );

  const files = data?.files ?? [];
  const tree = buildFolderTree(files);
  const hasFiles = files.length > 0;

  const handleUploadComplete = () => {
    mutate();
    setShowUpload(false);
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFolderSelect = (path: string) => {
    setSelectedPath(path);
    // Auto-expand parent paths
    if (path) {
      const parts = path.split("/").filter(Boolean);
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.add("");
        for (let i = 0; i < parts.length; i++) {
          next.add(parts.slice(0, i + 1).join("/"));
        }
        return next;
      });
    }
  };

  // Navigate into a subfolder from the content pane
  const navigateToSubfolder = (folder: TreeFolder) => {
    handleFolderSelect(folder.path);
  };

  // Resolve current folder
  const currentFolder = resolveFolderByPath(tree, selectedPath) ?? tree;
  const { subfolders, files: currentFiles } = getFolderContents(currentFolder);
  const breadcrumbs = getBreadcrumbs(selectedPath);

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6 max-w-6xl mx-auto w-full">
        <Content
          icon={SvgFolder}
          title="Company Files"
          description="Upload and browse documents indexed by the AI."
          sizePreset="section"
          variant="heading"
        />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-text-01" />
        </div>
      </div>
    );
  }

  // ─── Empty state ───
  if (!hasFiles) {
    return (
      <div className="flex flex-col gap-4 p-6 max-w-4xl mx-auto w-full">
        <Content
          icon={SvgFolder}
          title="Company Files"
          description="Upload and browse documents indexed by the AI to help answer your questions."
          sizePreset="section"
          variant="heading"
        />
        <CompanyFileUploadZone onUploadComplete={handleUploadComplete} />
        <Card padding={1}>
          <div className="flex flex-col items-center gap-3 py-8 w-full">
            <SvgFolder className="w-10 h-10 text-text-02" />
            <Text mainUiAction text03>
              No company files yet
            </Text>
            <Text secondaryBody text02 className="text-center max-w-sm">
              Upload files above to make them searchable by the AI for your
              entire team.
            </Text>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Explorer layout ───
  return (
    <div className="flex flex-col gap-3 p-6 max-w-6xl mx-auto w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Content
          icon={SvgFolder}
          title="Company Files"
          description="Browse and manage your company's indexed documents."
          sizePreset="main-content"
          variant="section"
        />
        <Button
          prominence="secondary"
          icon={SvgUploadCloud}
          size="sm"
          onClick={() => setShowUpload(!showUpload)}
        >
          Upload Files
        </Button>
      </div>

      {/* Upload zone (collapsible) */}
      {showUpload && (
        <div className="flex flex-col gap-2">
          <CompanyFileUploadZone onUploadComplete={handleUploadComplete} />
          <Button
            prominence="tertiary"
            size="sm"
            onClick={() => setShowUpload(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Two-panel explorer */}
      <div className="flex gap-0 border border-border-01 rounded-12 overflow-hidden min-h-[500px]">
        {/* ── Left sidebar: Folder tree ── */}
        <div className="w-64 shrink-0 border-r border-border-01 bg-background-neutral-01 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border-01">
            <Text secondaryBody text03 className="font-medium uppercase text-xs tracking-wider">
              Folders
            </Text>
          </div>
          <div className="py-1">
            {/* Root "All Files" node */}
            <SidebarFolderNode
              folder={tree}
              depth={0}
              selectedPath={selectedPath}
              onSelect={handleFolderSelect}
              expandedPaths={expandedPaths}
              onToggleExpand={toggleExpand}
            />
          </div>
        </div>

        {/* ── Right content: Files & subfolders ── */}
        <div className="flex-1 flex flex-col bg-background-tint-00 overflow-hidden">
          {/* Breadcrumb bar */}
          <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border-01 bg-background-neutral-01 flex-wrap min-h-[40px]">
            <button
              type="button"
              onClick={() => handleFolderSelect("")}
              className="hover:underline"
            >
              <Text
                secondaryBody
                className={cn(
                  selectedPath === ""
                    ? "text-text-05 font-medium"
                    : "text-action-link-05"
                )}
              >
                All Files
              </Text>
            </button>
            {breadcrumbs.map((crumb, i) => (
              <div key={crumb.path} className="flex items-center gap-1">
                <SvgChevronRight className="w-3 h-3 text-text-02" />
                {i === breadcrumbs.length - 1 ? (
                  <Text secondaryBody className="text-text-05 font-medium">
                    {crumb.name}
                  </Text>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleFolderSelect(crumb.path)}
                    className="hover:underline"
                  >
                    <Text secondaryBody className="text-action-link-05">
                      {crumb.name}
                    </Text>
                  </button>
                )}
              </div>
            ))}

            {/* Item count */}
            <div className="flex-1" />
            <Text secondaryBody text02>
              {subfolders.length > 0 &&
                `${subfolders.length} folder${subfolders.length !== 1 ? "s" : ""}`}
              {subfolders.length > 0 && currentFiles.length > 0 && ", "}
              {currentFiles.length > 0 &&
                `${currentFiles.length} file${currentFiles.length !== 1 ? "s" : ""}`}
              {subfolders.length === 0 && currentFiles.length === 0 && "Empty"}
            </Text>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_110px_80px_80px] gap-2 px-4 py-2 border-b border-border-01 bg-background-neutral-01">
            <Text secondaryBody text03>
              Name
            </Text>
            <Text secondaryBody text03>
              Date
            </Text>
            <Text secondaryBody text03>
              Type
            </Text>
            <Text secondaryBody text03>
              Size
            </Text>
          </div>

          {/* Content rows */}
          <div className="flex-1 overflow-y-auto">
            {/* Subfolders */}
            {subfolders.map((folder) => {
              const fileCount = countAllFiles(folder);
              return (
                <button
                  key={folder.path}
                  type="button"
                  onClick={() => navigateToSubfolder(folder)}
                  className="grid grid-cols-[1fr_110px_80px_80px] gap-2 px-4 py-2.5 border-b border-border-01 hover:bg-background-tint-01 transition-colors text-left w-full"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SvgFolder className="w-5 h-5 text-text-03 shrink-0" />
                    <Text mainUiAction text04 className="truncate">
                      {folder.name}
                    </Text>
                  </div>
                  <Text secondaryBody text02>
                    —
                  </Text>
                  <Text secondaryBody text02>
                    Folder
                  </Text>
                  <Text secondaryBody text02>
                    {fileCount} item{fileCount !== 1 ? "s" : ""}
                  </Text>
                </button>
              );
            })}

            {/* Files */}
            {currentFiles.map((file) => {
              const ext = getFileExtension(file.file_name);
              const colorClass = getFileTypeColor(ext);
              return (
                <div
                  key={file.file_id}
                  className="grid grid-cols-[1fr_110px_80px_80px] gap-2 px-4 py-2.5 border-b border-border-01 hover:bg-background-tint-01 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SvgFileText className="w-5 h-5 text-text-03 shrink-0" />
                    <Text mainUiAction text04 className="truncate">
                      {file.file_name}
                    </Text>
                  </div>
                  <Text secondaryBody text02>
                    {formatDate(file.upload_date)}
                  </Text>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-04 text-xs font-medium w-fit",
                      colorClass
                    )}
                  >
                    {ext}
                  </span>
                  <Text secondaryBody text02>
                    {formatFileSize(file.file_size)}
                  </Text>
                </div>
              );
            })}

            {/* Empty folder */}
            {subfolders.length === 0 && currentFiles.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12">
                <SvgFolder className="w-8 h-8 text-text-02" />
                <Text secondaryBody text03>
                  This folder is empty
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
