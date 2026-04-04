import { useState, useEffect } from "react";

const API = "http://localhost:5001";

interface FileItem {
  name: string;
  size_kb: number;
  uploaded_at: string;
}

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const res = await fetch(`${API}/files`);
      const data = await res.json();
      setFiles(data.files);
    } catch {
      showMessage("Failed to load files", "error");
    }
  }

  async function uploadFile() {
    if (!selectedFile) {
      showMessage("Please select a file", "error");
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const res = await fetch(`${API}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Uploaded successfully!", "success");
        loadFiles();
      } else {
        showMessage(data.error, "error");
      }
    } catch {
      showMessage("Upload failed. Is the backend running?", "error");
    }
  }

  async function downloadFile(name: string) {
    const res = await fetch(`${API}/files/${name}/download`);
    const data = await res.json();
    if (res.ok) window.open(data.url, "_blank");
    else showMessage(data.error, "error");
  }

  async function deleteFile(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    const res = await fetch(`${API}/files/${name}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      showMessage(data.message, "success");
      loadFiles();
    } else {
      showMessage(data.error, "error");
    }
  }

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 700,
        margin: "40px auto",
        padding: "0 20px",
      }}
    >
      <h1>📁 File Upload App</h1>

      <div style={{ marginBottom: 30 }}>
        <input
          type="file"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />
        <button onClick={uploadFile}>Upload</button>
        {message && (
          <div
            style={{
              marginTop: 10,
              fontWeight: "bold",
              color: messageType === "error" ? "red" : "green",
            }}
          >
            {message}
          </div>
        )}
      </div>

      <h2>Uploaded Files</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Name
            </th>
            <th
              style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Size
            </th>
            <th
              style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Uploaded
            </th>
            <th
              style={{
                textAlign: "left",
                padding: 8,
                borderBottom: "1px solid #ddd",
              }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.name}>
              <td style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
                {f.name}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
                {f.size_kb} KB
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
                {f.uploaded_at}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
                <button
                  onClick={() => downloadFile(f.name)}
                  style={{
                    color: "blue",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ⬇ Download
                </button>
                <button
                  onClick={() => deleteFile(f.name)}
                  style={{
                    color: "red",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  🗑 Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
