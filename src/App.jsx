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
  AlertCircle
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
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isLocked) {
      fetchFiles();
    }
  }, [isLocked]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .list('', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      const formattedFiles = data.map(file => {
        const extension = file.name.split('.').pop().toLowerCase();
        let type = 'doc';
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) type = 'image';
        if (['mp4', 'mov', 'avi', 'webm'].includes(extension)) type = 'video';
        if (['mp3', 'wav', 'ogg'].includes(extension)) type = 'music';

        const { data: { publicUrl } } = supabase
          .storage
          .from(BUCKET_NAME)
          .getPublicUrl(file.name);

        return {
          id: file.id,
          name: file.name,
          realPath: file.name,
          type,
          url: publicUrl,
          size: (file.metadata.size / (1024 * 1024)).toFixed(2) + ' MB',
          date: new Date(file.created_at).toLocaleDateString(),
          starred: false
        };
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
        const { error } = await supabase
          .storage
          .from(BUCKET_NAME)
          .upload(fileName, file);
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

  const deleteFile = async (realPath) => {
    if (!window.confirm('Hapus file ini?')) return;

    try {
      const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove([realPath]);

      if (error) throw error;
      fetchFiles();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const downloadFile = async (realPath) => {
    try {
      const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(realPath);

      if (error) throw error;

      window.open(data.publicUrl, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === DEFAULT_PIN) {
      setIsLocked(false);
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
      // Shake animation effect could be added here
    }
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
      case 'image': return <ImageIcon size={size} className="text-cyan-400" />;
      case 'video': return <Video size={size} className="text-purple-400" />;
      case 'music': return <Music size={size} className="text-pink-400" />;
      default: return <FileText size={size} className="text-indigo-400" />;
    }
  };

  if (isLocked) {
    return (
      <div className="pin-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="pin-card glass"
        >
          <div className="pin-icon-wrapper">
            <Lock size={32} className="text-accent-primary" />
          </div>
          <h2>Authentication Required</h2>
          <p>Please enter your PIN to access CloudDuta</p>

          <form onSubmit={handlePinSubmit}>
            <div className={`pin-input-group ${pinError ? 'error' : ''}`}>
              <input
                type="password"
                maxLength="4"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                autoComplete="new-password"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            {pinError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="error-message"
              >
                <AlertCircle size={14} />
                <span>Incorrect PIN. Please try again.</span>
              </motion.div>
            )}
            <button type="submit" className="btn-primary pin-submit-btn">
              Unlock Storage
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

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
        />

        <button
          className="btn-primary upload-btn"
          onClick={() => fileInputRef.current.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
          <span>{isUploading ? 'Uploading...' : 'Add New'}</span>
        </button>

        <nav className="side-nav">
          <NavItem active={activeTab === 'All Files'} onClick={() => setActiveTab('All Files')} icon={<Files size={20} />} label="All Files" />
          <NavItem active={activeTab === 'Recent'} onClick={() => setActiveTab('Recent')} icon={<Clock size={20} />} label="Recent" />
          <NavItem active={activeTab === 'Starred'} onClick={() => setActiveTab('Starred')} icon={<Star size={20} />} label="Starred" />
          <NavItem active={activeTab === 'Trash'} onClick={() => setActiveTab('Trash')} icon={<Trash2 size={20} />} label="Trash" />
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

        <button className="btn-logout" onClick={() => {
          setIsLocked(true);
          setPin('');
        }}>
          <Unlock size={18} />
          <span>Lock Session</span>
        </button>
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
            <button className="btn-icon"><Bell size={20} /></button>
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
            <div className="breadcrumb">
              <span>Cloud Storage</span>
              <ChevronRight size={14} />
              <span className="active">{activeTab}</span>
            </div>

            <div className="view-controls">
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
                        <span className="file-name">{file.name.split('-').slice(1).join('-') || file.name}</span>
                        <span className="file-meta">{file.date} • {file.size}</span>
                      </div>
                      <div className="card-actions">
                        <button className="btn-icon" onClick={() => downloadFile(file.realPath)}>
                          <Download size={16} className="text-accent-secondary" />
                        </button>
                        <button className="btn-icon dropdown-btn" onClick={() => deleteFile(file.realPath)}>
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
