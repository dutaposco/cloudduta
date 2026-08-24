import React, { useState, useEffect, useRef } from 'react';
import {
  Cloud,
  Files,
  HardDrive,
  Clock,
  Star,
  Trash2,
  Plus,
  Search,
  LayoutGrid,
  List,
  Bell,
  User,
  ChevronRight,
  ImageIcon,
  FileText,
  Video,
  Music,
  MoreVertical,
  Upload,
  Loader2,
  Download,
  Lock,
  Unlock,
  AlertCircle,
  RotateCcw,
  Save,
  FileEdit,
  X,
  FolderPlus,
  Folder,
  Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import './App.css';

const BUCKET_NAME = 'files';
const DEFAULT_PIN = '6767';

function App() {
  const [activeTab, setActiveTab] = useState('All Files');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isNotepadOpen, setIsNotepadOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNotePath, setEditingNotePath] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, [currentPath]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .list(currentPath, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      const formattedFiles = data
        .filter(file => file.name !== '.keep' && file.name !== '.emptyFolderPlaceholder')
        .map(file => {
          if (!file.metadata) {
            // Folder
            return {
              id: `folder-${file.name}`,
              name: file.name,
              realPath: currentPath ? `${currentPath}/${file.name}` : file.name,
              type: 'folder',
              url: null,
              size: '-',
              date: '-',
              starred: false
            };
          }

          const extension = file.name.split('.').pop().toLowerCase();
          let type = 'doc';
          if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) type = 'image';
          if (['mp4', 'mov', 'avi', 'webm'].includes(extension)) type = 'video';
          if (['mp3', 'wav', 'ogg'].includes(extension)) type = 'music';

          const { data: { publicUrl } } = supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(currentPath ? `${currentPath}/${file.name}` : file.name);

          return {
            id: file.id,
            name: file.name,
            realPath: currentPath ? `${currentPath}/${file.name}` : file.name,
            type,
            url: publicUrl,
            size: (file.metadata.size / (1024 * 1024)).toFixed(2) + ' MB',
            date: new Date(file.created_at).toLocaleDateString(),
            starred: false
          };
        });

      formattedFiles.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return 0;
      });

      setFiles(formattedFiles);
    } catch (err) {
      console.error('Error fetching files:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const fileList = e.target.files || e.dataTransfer.files;
    if (!fileList || fileList.length === 0) return;

    try {
      setIsUploading(true);
      const uploadPromises = Array.from(fileList).map(async (file) => {
        const fileName = `${Date.now()}-${file.name}`;
        const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
        const { error } = await supabase
          .storage
          .from(BUCKET_NAME)
          .upload(fullPath, file);
        if (error) throw error;
      });

      await Promise.all(uploadPromises);
      fetchFiles();
    } catch (err) {
      alert(`Upload failed: ${err.message}. Pastikan bucket 'files' sudah dibuat di Supabase Dashboard (Storage) dan diatur ke Public.`);
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      setIsUploading(true);
      const folderPath = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
      
      const blob = new Blob([''], { type: 'text/plain' });
      const file = new File([blob], '.keep', { type: 'text/plain' });

      const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(`${folderPath}/.keep`, file);

      if (error) throw error;
      
      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
      fetchFiles();
    } catch (err) {
      alert(`Gagal membuat folder: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteAllInFolder = async () => {
    if (!currentPath) return;
    if (files.length === 0) {
      alert('Folder sudah kosong.');
      return;
    }
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA file di dalam folder ini secara permanen?')) return;

    try {
      setLoading(true);
      const pathsToDelete = files.map(file => file.realPath);
      
      const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove(pathsToDelete);

      if (error) throw error;
      
      fetchFiles();
    } catch (err) {
      console.error('Delete all failed:', err);
      alert('Gagal menghapus semua file: ' + err.message);
      setLoading(false);
    }
  };

  const deleteFile = async (realPath, type) => {
    let pathToDelete = realPath;
    
    if (type === 'folder') {
      if (!window.confirm('Hapus folder ini? Pastikan Anda sudah menghapus isinya terlebih dahulu.')) return;
      pathToDelete = `${realPath}/.keep`;
    } else {
      if (!window.confirm('Hapus file ini secara permanen?')) return;
    }

    try {
      const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove([pathToDelete]);

      if (error) throw error;
      fetchFiles();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Gagal menghapus file: ' + err.message);
    }
  };

  const downloadFile = async (realPath, fileName) => {
    try {
      const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(realPath);

      if (error) throw error;

      // Force download by creating a temporary link
      const link = document.createElement('a');
      const cleanName = fileName || realPath.split('-').slice(1).join('-') || realPath;

      // Add download parameter for Supabase storage
      link.href = `${data.publicUrl}${data.publicUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(cleanName)}`;
      link.download = cleanName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Gagal mendownload file');
    }
  };

  const handleFileClick = (file) => {
    // Single click logic can be kept simple or removed if double click is preferred
  };

  const handleDoubleClick = (file) => {
    if (file.type === 'folder') {
      setCurrentPath(file.realPath);
    } else if (file.type === 'doc' && file.name.toLowerCase().endsWith('.txt')) {
      const { data: { publicUrl } } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(file.realPath);
      openNoteInNotepad(file.realPath, publicUrl);
    } else {
      setPreviewFile(file);
    }
  };

  const openNoteInNotepad = async (realPath, url) => {
    try {
      setLoading(true);
      const response = await fetch(url);
      const text = await response.text();

      const fileName = realPath.split('-').slice(1).join('-') || realPath;
      setNoteTitle(fileName.replace('.txt', ''));
      setNoteContent(text);
      setEditingNotePath(realPath);
      setIsNotepadOpen(true);
    } catch (err) {
      console.error('Failed to open note:', err);
      alert('Gagal membuka catatan');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      alert('Masukkan judul catatan!');
      return;
    }

    try {
      setIsSavingNote(true);
      const fileName = noteTitle.trim().endsWith('.txt')
        ? noteTitle.trim()
        : `${noteTitle.trim()}.txt`;

      // If we're editing, we might want to keep the same prefix or just create a new one
      // For simplicity, let's always create a new entry if editingNotePath is null
      // or overwrite if editingNotePath exists
      const baseName = `${Date.now()}-${fileName}`;
      const fullFileName = editingNotePath || (currentPath ? `${currentPath}/${baseName}` : baseName);

      const blob = new Blob([noteContent], { type: 'text/plain' });
      const file = new File([blob], fileName, { type: 'text/plain' });

      const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(fullFileName, file, { upsert: true });

      if (error) throw error;

      setIsNotepadOpen(false);
      setNoteTitle('');
      setNoteContent('');
      setEditingNotePath(null);
      fetchFiles();
    } catch (err) {
      console.error('Save note failed:', err);
      alert('Gagal menyimpan catatan: ' + err.message);
    } finally {
      setIsSavingNote(false);
    }
  };

  const createNewNote = () => {
    setNoteTitle('');
    setNoteContent('');
    setEditingNotePath(null);
    setIsNotepadOpen(true);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleUpload(e);
  };

  const getFileIcon = (type, size = 20) => {
    switch (type) {
      case 'folder': return <Folder size={size} className="text-yellow-400" />;
      case 'image': return <ImageIcon size={size} className="text-cyan-400" />;
      case 'video': return <Video size={size} className="text-purple-400" />;
      case 'music': return <Music size={size} className="text-pink-400" />;
      default: return <FileText size={size} className="text-indigo-400" />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass">
        <div className="logo-container">
          <div className="logo-icon">
            <Cloud size={28} color="#6366f1" fill="#6366f1" fillOpacity={0.2} />
          </div>
          <span className="logo-text">CloudDuta</span>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleUpload}
          multiple
          webkitdirectory="true"
        />

        <button
          className="btn-primary upload-btn"
          onClick={() => fileInputRef.current.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
          <span>{isUploading ? 'Uploading...' : 'Add New'}</span>
        </button>

        <button
          className="btn-primary upload-btn"
          style={{ marginTop: '10px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.5)' }}
          onClick={() => setIsCreateFolderModalOpen(true)}
          disabled={isUploading}
        >
          <FolderPlus size={20} />
          <span>New Folder</span>
        </button>

        <nav className="side-nav">
          <NavItem active={activeTab === 'All Files'} onClick={() => setActiveTab('All Files')} icon={<Files size={20} />} label="All Files" />
          <NavItem active={false} onClick={createNewNote} icon={<FileEdit size={20} />} label="New Note" />
        </nav>

        <div className="storage-card glass">
          <div className="storage-info">
            <div className="storage-header">
              <HardDrive size={16} />
              <span>Storage</span>
            </div>
            <span className="storage-usage">
              {files.length > 0 ? (Math.min(files.length * 2, 100)).toString() + '%' : '0%'} used
            </span>
          </div>
          <div className="progress-bar">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: files.length > 0 ? (Math.min(files.length * 2, 100)).toString() + '%' : '0%' }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <span className="storage-detail">Supabase Cloud Ready</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header">
          <div className="search-bar glass">
            <Search size={18} className="text-secondary" />
            <input
              type="text"
              placeholder="Search your files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="header-actions">
            <div className="user-profile glass">
              <div className="avatar">
                <User size={20} />
              </div>
              <span className="username">Duta</span>
            </div>
          </div>
        </header>

        <section className="content-section">
          <div className="section-header">
            <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                className="cursor-pointer hover:text-accent-primary" 
                onClick={() => setCurrentPath('')}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Home size={16} /> Root
              </span>
              {currentPath && (
                <>
                  <ChevronRight size={14} />
                  <span className="active" style={{ color: '#6366f1' }}>{currentPath.split('/').pop()}</span>
                </>
              )}
            </div>

            <div className="view-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {currentPath && files.length > 0 && (
                <button 
                  className="btn-icon" 
                  onClick={deleteAllInFolder} 
                  title="Hapus Semua Isi Folder"
                  style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          <div
            className={`upload-dropzone glass ${isDragging ? 'dragging' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <Upload size={32} className={isDragging ? 'text-accent-primary animate-bounce' : 'text-accent-secondary'} />
            <h3>{isDragging ? 'Release to upload' : 'Drop your files here to upload'}</h3>
            <p>Direct upload to Supabase Cloud (Supports multiple files)</p>
          </div>

          {loading ? (
            <div className="loading-state">
              <Loader2 size={40} className="animate-spin text-accent-primary" />
              <p>Fetching your files...</p>
            </div>
          ) : (
            <div className={`file-display ${viewMode}`}>
              <AnimatePresence>
                {files
                  .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((file, idx) => (
                    <motion.div
                      key={file.realPath}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      className="file-card glass"
                      onDoubleClick={() => handleDoubleClick(file)}
                    >
                      <div className="file-icon-wrapper overflow-hidden">
                        {file.type === 'image' ? (
                          <img src={file.url} alt={file.name} className="file-preview-image" loading="lazy" />
                        ) : file.type === 'video' ? (
                          <video src={file.url} className="file-preview-video" muted />
                        ) : (
                          getFileIcon(file.type, viewMode === 'grid' ? 48 : 20)
                        )}
                      </div>
                      <div className="file-info">
                        <span className="file-name" title="Double-click to open/preview">
                          {file.type === 'folder' ? file.name : (file.name.split('-').slice(1).join('-') || file.name)}
                        </span>
                        <span className="file-meta">{file.date} • {file.size}</span>
                      </div>
                      <div className="card-actions">
                        {file.type !== 'folder' && (
                          <button className="btn-icon" onClick={() => downloadFile(file.realPath, file.name.split('-').slice(1).join('-'))} title="Download to PC">
                            <Download size={16} className="text-accent-secondary" />
                          </button>
                        )}
                        <button className="btn-icon" onClick={() => deleteFile(file.realPath, file.type)} title="Delete">
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
              {!loading && files.length === 0 && (
                <div className="empty-state">
                  <Files size={64} className="text-secondary opacity-20" />
                  <p>No files found. Start by uploading some!</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Notepad Modal */}
      <AnimatePresence>
        {isNotepadOpen && (
          <motion.div
            className="notepad-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="notepad-modal glass"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <header className="notepad-header">
                <div className="notepad-title-group">
                  <FileText className="text-accent-primary" size={24} />
                  <input
                    type="text"
                    placeholder="Judul Catatan..."
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="notepad-title-input"
                  />
                </div>
                <div className="notepad-actions">
                  <button
                    className="btn-primary"
                    onClick={handleSaveNote}
                    disabled={isSavingNote}
                  >
                    {isSavingNote ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    <span>{isSavingNote ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button className="btn-icon" onClick={() => setIsNotepadOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
              </header>
              <textarea
                className="notepad-textarea"
                placeholder="Mulai mengetik di sini..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                autoFocus
              />
              <footer className="notepad-footer">
                <span>{noteContent.length} characters</span>
                <span>{noteContent.split(/\s+/).filter(Boolean).length} words</span>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {isCreateFolderModalOpen && (
          <motion.div
            className="notepad-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="notepad-modal glass"
              style={{ maxWidth: '400px', minHeight: 'auto', padding: '0' }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <header className="notepad-header">
                <div className="notepad-title-group" style={{ display: 'flex', alignItems: 'center' }}>
                  <FolderPlus className="text-accent-primary" size={24} />
                  <h3 style={{ margin: '0 0 0 10px', color: 'white', fontSize: '18px' }}>Create Folder</h3>
                </div>
                <button className="btn-icon" onClick={() => setIsCreateFolderModalOpen(false)}>
                  <X size={20} />
                </button>
              </header>
              <div style={{ padding: '24px' }}>
                <input
                  type="text"
                  placeholder="Folder Name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    color: 'white',
                    outline: 'none',
                    marginBottom: '20px'
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button 
                    style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }} 
                    onClick={() => setIsCreateFolderModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    style={{ padding: '10px 16px', borderRadius: '8px', background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '500' }} 
                    onClick={handleCreateFolder}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            className="preview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              className="preview-content glass"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="preview-header">
                <div className="preview-title-info">
                  {getFileIcon(previewFile.type)}
                  <div className="preview-title-text">
                    <h3>{previewFile.name.split('-').slice(1).join('-') || previewFile.name}</h3>
                    <span>{previewFile.date} • {previewFile.size}</span>
                  </div>
                </div>
                <div className="preview-actions">
                  <button className="btn-icon" onClick={() => downloadFile(previewFile.realPath, previewFile.name.split('-').slice(1).join('-'))}>
                    <Download size={20} />
                  </button>
                  <button className="btn-icon" onClick={() => setPreviewFile(null)}>
                    <X size={20} />
                  </button>
                </div>
              </header>

              <div className="preview-body">
                {previewFile.type === 'image' && (
                  <img src={previewFile.url} alt={previewFile.name} className="preview-image" />
                )}
                {previewFile.type === 'video' && (
                  <video src={previewFile.url} controls autoPlay className="preview-video" />
                )}
                {previewFile.type === 'music' && (
                  <div className="audio-preview-container">
                    <Music size={64} className="text-pink-400 mb-4" />
                    <audio src={previewFile.url} controls autoPlay className="preview-audio" />
                  </div>
                )}
                {previewFile.type === 'doc' && !previewFile.name.toLowerCase().endsWith('.txt') && (
                  <div className="doc-preview-container">
                    <FileText size={64} className="text-indigo-400 mb-4" />
                    <p>Format file ini tidak dapat ditampilkan langsung.</p>
                    <button className="btn-primary" onClick={() => downloadFile(previewFile.realPath, previewFile.name)}>
                      Download untuk melihat
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <motion.div
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="nav-icon">{icon}</div>
      <span className="nav-label">{label}</span>
      {active && <motion.div className="active-indicator" layoutId="activeNav" />}
    </motion.div>
  );
}

export default App;
