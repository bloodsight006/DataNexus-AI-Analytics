import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, RadialLinearScale, BarElement, 
  PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Pie, Radar, Scatter } from 'react-chartjs-2';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

import { useDropzone } from 'react-dropzone';
import html2pdf from 'html2pdf.js';

ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

// Premium Skeleton Loader
const Skeleton = ({ height = "20px", width = "100%", borderRadius = "12px" }) => (
  <div style={{ 
    height, width, borderRadius, 
    backgroundColor: "rgba(161, 161, 170, 0.1)",
    marginBottom: "15px",
    position: "relative",
    overflow: "hidden"
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
      animation: "shimmer 1.5s infinite"
    }} />
  </div>
);

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [user, setUser] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(true); 
  const [authLoading, setAuthLoading] = useState(true);

  // --- SIDEBAR TOGGLE STATE ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [dashboards, setDashboards] = useState(() => {
    const saved = localStorage.getItem("savedDashboards");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeIndex, setActiveIndex] = useState(0);
  
  const [files, setFiles] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginInput, setLoginInput] = useState({ email: "", password: "" });

  const [activeTab, setActiveTab] = useState("charts"); 
  const [chartType, setChartType] = useState("bar");
  const [selectedX, setSelectedX] = useState("Row Index");
  const [selectedY, setSelectedY] = useState("");

  const [missingValuesChoice, setMissingValuesChoice] = useState("mean");
  const [removeDuplicatesChoice, setRemoveDuplicatesChoice] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const rowsPerPage = 100;

  const chartRef = useRef(null);
  const reportRef = useRef(null); 

  const currentDashboard = dashboards[activeIndex] || null;

  const onDrop = (acceptedFiles) => setFiles(acceptedFiles);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } 
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe(); 
  }, []);

  useEffect(() => {
    if (currentDashboard && currentDashboard.numeric_columns.length > 0) {
      setSelectedY(currentDashboard.numeric_columns[0]);
      setSelectedX("Row Index");
      setSearchQuery(""); 
      setPageIndex(0); 
    }
  }, [activeIndex, currentDashboard]);

  useEffect(() => { setPageIndex(0); }, [searchQuery]);

  // Premium Modern Palette
  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#09090b" : "#f8fafc",          
    sidebar: isDark ? "#121214" : "#ffffff",     
    card: isDark ? "#18181b" : "#ffffff",        
    border: isDark ? "#27272a" : "#e2e8f0",      
    text: isDark ? "#fafafa" : "#0f172a",        
    textMuted: isDark ? "#a1a1aa" : "#64748b",   
    primary: "#6366f1",                          
    primaryGradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    danger: "#ef4444",
    dangerLight: isDark ? "rgba(239,68,68,0.1)" : "#fee2e2",
    info: "#3b82f6", 
    infoGradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    warning: "#f59e0b", 
    success: "#10b981",
    inputBg: isDark ? "#09090b" : "#f1f5f9",
  };

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.body.style.backgroundColor = colors.bg;
    document.body.style.color = colors.text;
    document.body.style.margin = "0";
    document.body.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
    document.body.style.transition = "background-color 0.3s ease";
  }, [theme, colors.bg, colors.text]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    if (loginInput.password.length < 6) return setError("Password requires at least 6 characters.");
    try {
      if (isLoginMode) await signInWithEmailAndPassword(auth, loginInput.email, loginInput.password);
      else await createUserWithEmailAndPassword(auth, loginInput.email, loginInput.password);
      setLoginInput({ email: "", password: "" }); 
    } catch (err) { setError(err.message.replace("Firebase: ", "")); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDashboards([]);
    localStorage.removeItem("savedDashboards");
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return setError("Please select a file first.");
    setLoading(true);
    setError("");
    
    const newDashboards = [];
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append("file", files[i]);
      formData.append("missing_values", missingValuesChoice);
      formData.append("remove_duplicates", removeDuplicatesChoice ? "true" : "false");

      try {
        const response = await axios.post("https://datanexus-api.onrender.com/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        newDashboards.push(response.data);
      } catch (err) { 
        console.error(err);
        setError(`Error processing file ${files[i].name}.`); 
      }
    }

    if (newDashboards.length > 0) {
      let updatedDashboards = [...dashboards];
      newDashboards.forEach(newDash => {
        const existingIndex = updatedDashboards.findIndex(d => d.filename === newDash.filename);
        if (existingIndex >= 0) updatedDashboards[existingIndex] = newDash;
        else updatedDashboards.push(newDash);
      });
      setDashboards(updatedDashboards);
      localStorage.setItem("savedDashboards", JSON.stringify(updatedDashboards));
      setActiveIndex(updatedDashboards.findIndex(d => d.filename === newDashboards[newDashboards.length - 1].filename));
      setActiveTab("insights"); 
    }
    setLoading(false);
    setFiles([]); 
  };

  const downloadPDFReport = () => {
    if (!currentDashboard) return;
    const element = reportRef.current;
    
    const originalAnimation = element.style.animation;
    element.style.animation = 'none';

    const opt = {
      margin: 0.3,
      filename: `${currentDashboard.filename}_AI_Report.pdf`,
      image: { type: 'jpeg', quality: 1.0 }, 
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: theme === 'dark' ? '#09090b' : '#f8fafc',
        windowWidth: element.scrollWidth 
      },
      jsPDF: { unit: 'in', format: 'a3', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      element.style.animation = originalAnimation;
    });
  };

  const clearCurrentDashboard = () => {
    const updatedDashboards = dashboards.filter((_, idx) => idx !== activeIndex);
    setDashboards(updatedDashboards);
    localStorage.setItem("savedDashboards", JSON.stringify(updatedDashboards));
    setActiveIndex(0);
  };

  const clearAllDashboards = () => {
    setDashboards([]);
    localStorage.removeItem("savedDashboards");
    setActiveIndex(0);
  };

  const downloadCSV = () => {
    if (!currentDashboard) return;
    const blob = new Blob([currentDashboard.cleaned_csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `cleaned_${currentDashboard.filename.replace('.xlsx', '.csv')}`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const filteredData = currentDashboard ? currentDashboard.data.filter(row => {
    if (!searchQuery) return true;
    return Object.values(row).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()));
  }) : [];

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = filteredData.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);

  let chartConfig = null;
  if (currentDashboard && selectedY) {
    const labels = selectedX === "Row Index" ? currentDashboard.data.map((_, i) => `Row ${i + 1}`) : currentDashboard.data.map(row => row[selectedX]);
    const dataPoints = currentDashboard.data.map(row => row[selectedY]);
    const bgColors = chartType === 'pie' ? ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] : 'rgba(99, 102, 241, 0.3)';

    chartConfig = {
      labels: labels,
      datasets: [{
        label: `${selectedY} by ${selectedX}`,
        data: dataPoints,
        backgroundColor: chartType === 'radar' ? 'rgba(99, 102, 241, 0.2)' : bgColors,
        borderColor: chartType === 'pie' ? colors.card : colors.primary,
        borderWidth: 2,
        borderRadius: chartType === 'bar' ? 6 : 0,
        fill: chartType === 'radar' || chartType === 'area',
        tension: 0.4, 
        barPercentage: chartType === 'histogram' ? 1.0 : 0.8,
        categoryPercentage: chartType === 'histogram' ? 1.0 : 0.8,
      }],
    };
  }

  const renderChart = () => {
    if (!chartConfig) return <p style={{color: colors.textMuted}}>No numeric data to plot.</p>;
    const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: colors.text, font: {family: 'Inter'} } } }, scales: chartType === 'pie' || chartType === 'radar' ? {} : { x: { grid: {color: colors.border}, ticks: { color: colors.textMuted } }, y: { grid: {color: colors.border}, ticks: { color: colors.textMuted } } } };
    
    if (chartType === 'line' || chartType === 'area') return <Line ref={chartRef} data={chartConfig} options={options} />;
    if (chartType === 'pie') return <Pie ref={chartRef} data={chartConfig} options={options} />;
    if (chartType === 'radar') return <Radar ref={chartRef} data={chartConfig} options={options} />;
    if (chartType === 'scatter') {
      const scatterData = { datasets: [{ label: chartConfig.datasets[0].label, data: chartConfig.labels.map((label, i) => ({ x: i, y: chartConfig.datasets[0].data[i] })), backgroundColor: colors.primary }] };
      return <Scatter ref={chartRef} data={scatterData} options={options} />;
    }
    return <Bar ref={chartRef} data={chartConfig} options={options} />;
  };

  const cardStyle = {
    backgroundColor: colors.card,
    borderRadius: "16px",
    border: `1px solid ${colors.border}`,
    padding: "24px",
    boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
  };

  if (authLoading) return <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: colors.bg, color: colors.text, fontFamily: "Inter" }}>Loading Workspace...</div>;

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: colors.bg }}>
        <div style={{ ...cardStyle, width: "100%", maxWidth: "420px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
          <h2 style={{ textAlign: "center", marginBottom: "5px", background: colors.primaryGradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: "32px", fontWeight: "800" }}>DataNexus</h2>
          <p style={{ textAlign: "center", color: colors.textMuted, marginBottom: "32px", fontSize: "15px" }}>{isLoginMode ? "Sign in to your AI workspace" : "Create your free account"}</p>
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input type="email" placeholder="Email Address" value={loginInput.email} onChange={(e) => setLoginInput({...loginInput, email: e.target.value})} style={{ padding: "14px", borderRadius: "10px", border: `1px solid ${colors.border}`, backgroundColor: colors.inputBg, color: colors.text, outline: "none", fontSize: "15px", transition: "border-color 0.2s" }} onFocus={(e) => e.target.style.borderColor = colors.primary} onBlur={(e) => e.target.style.borderColor = colors.border} required />
            <input type="password" placeholder="Password" value={loginInput.password} onChange={(e) => setLoginInput({...loginInput, password: e.target.value})} style={{ padding: "14px", borderRadius: "10px", border: `1px solid ${colors.border}`, backgroundColor: colors.inputBg, color: colors.text, outline: "none", fontSize: "15px", transition: "border-color 0.2s" }} onFocus={(e) => e.target.style.borderColor = colors.primary} onBlur={(e) => e.target.style.borderColor = colors.border} required />
            {error && <div style={{ color: colors.danger, fontSize: "13px", padding: "12px", backgroundColor: colors.dangerLight, borderRadius: "8px", border: `1px solid rgba(239,68,68,0.2)` }}>{error}</div>}
            <button type="submit" style={{ padding: "14px", background: colors.primaryGradient, color: "white", border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "16px", marginTop: "8px", boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)", transition: "opacity 0.2s" }} onMouseOver={e=>e.target.style.opacity=0.9} onMouseOut={e=>e.target.style.opacity=1}>
              {isLoginMode ? "Login to Workspace" : "Create Account"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: colors.textMuted }}>
            {isLoginMode ? "New to DataNexus? " : "Already have an account? "}
            <span onClick={() => {setIsLoginMode(!isLoginMode); setError("");}} style={{ color: colors.primary, cursor: "pointer", fontWeight: "600" }}>{isLoginMode ? "Sign up here" : "Login here"}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: colors.bg }}>
      
      {/* SIDEBAR WITH COLLAPSE ANIMATION */}
      <div style={{ 
        width: isSidebarOpen ? "260px" : "0px", 
        opacity: isSidebarOpen ? 1 : 0,
        backgroundColor: colors.sidebar, 
        borderRight: isSidebarOpen ? `1px solid ${colors.border}` : "none", 
        display: "flex", 
        flexDirection: "column", 
        padding: isSidebarOpen ? "24px 0" : "0", 
        zIndex: 10,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        whiteSpace: "nowrap"
      }}>
        <div style={{ padding: "0 24px", marginBottom: "40px", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: colors.primaryGradient, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold" }}>N</div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px", color: colors.text }}>DataNexus</h2>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "0 16px", flex: 1 }}>
          <div onClick={() => setActiveTab("charts")} style={{ padding: "12px 16px", backgroundColor: activeTab === "charts" ? "rgba(99,102,241,0.1)" : "transparent", color: activeTab === "charts" ? colors.primary : colors.textMuted, borderRadius: "10px", cursor: "pointer", fontWeight: "600", fontSize: "14px", transition: "all 0.2s" }}>
              Visualizations
          </div>
          <div onClick={() => setActiveTab("insights")} style={{ padding: "12px 16px", backgroundColor: activeTab === "insights" ? "rgba(99,102,241,0.1)" : "transparent", color: activeTab === "insights" ? colors.primary : colors.textMuted, borderRadius: "10px", cursor: "pointer", fontWeight: "600", fontSize: "14px", transition: "all 0.2s" }}>
              AI Insights
          </div>
          <div onClick={() => setActiveTab("datagrid")} style={{ padding: "12px 16px", backgroundColor: activeTab === "datagrid" ? "rgba(99,102,241,0.1)" : "transparent", color: activeTab === "datagrid" ? colors.primary : colors.textMuted, borderRadius: "10px", cursor: "pointer", fontWeight: "600", fontSize: "14px", transition: "all 0.2s" }}>
              Data Explorer
          </div>
        </div>

        <div style={{ padding: "0 16px", marginTop: "auto" }}>
          <div style={{ padding: "12px", marginBottom: "16px", fontSize: "12px", color: colors.textMuted, backgroundColor: colors.inputBg, borderRadius: "10px", border: `1px solid ${colors.border}` }}>
            <span style={{ display: "block", marginBottom: "4px", textTransform: "uppercase", fontSize: "10px", fontWeight: "bold" }}>Account</span>
            <strong style={{color: colors.text, wordWrap: "break-word"}}>{user.email}</strong>
          </div>
          <button onClick={handleLogout} style={{ width: "100%", padding: "12px", backgroundColor: "transparent", color: colors.textMuted, border: `1px solid ${colors.border}`, borderRadius: "10px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s" }} onMouseOver={e=>{e.target.style.color=colors.danger; e.target.style.borderColor=colors.danger}} onMouseOut={e=>{e.target.style.color=colors.textMuted; e.target.style.borderColor=colors.border}}>
            Log Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>
        
        {/* TOP NAVBAR WITH SANDWICH BUTTON */}
        <div style={{ height: "70px", minHeight: "70px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", borderBottom: `1px solid ${colors.border}`, backgroundColor: "rgba(var(--bg), 0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 5 }}>
          
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: "transparent", border: "none", color: colors.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", borderRadius: "8px", transition: "background-color 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor=colors.inputBg} onMouseOut={e=>e.currentTarget.style.backgroundColor="transparent"}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <button onClick={() => setTheme(isDark ? "light" : "dark")} style={{ background: colors.card, border: `1px solid ${colors.border}`, padding: "8px 16px", borderRadius: "20px", color: colors.text, cursor: "pointer", fontWeight: "500", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>

        <div style={{ padding: "32px", maxWidth: "1400px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          
          {/* UPLOAD AREA */}
          <div {...getRootProps()} style={{ 
            ...cardStyle,
            border: isDragActive ? `2px solid ${colors.primary}` : `1px dashed ${colors.border}`, 
            backgroundColor: isDragActive ? "rgba(99,102,241,0.02)" : colors.card,
            padding: "48px 32px", 
            textAlign: "center", 
            marginBottom: "32px", 
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}>
            <input {...getInputProps()} />
            
            <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginBottom: "20px" }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
            </div>

            <h3 style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700" }}>
                {isDragActive ? "Drop to upload" : "Drag & Drop Datasets"}
            </h3>
            <p style={{ color: colors.textMuted, margin: "0 0 24px 0", fontSize: "15px" }}>Upload .csv or .xlsx files to generate AI-powered dashboards.</p>
            
            {files.length > 0 && (
              <div style={{ marginBottom: "20px", display: "inline-block", padding: "8px 16px", backgroundColor: "rgba(99,102,241,0.1)", color: colors.primary, borderRadius: "20px", fontSize: "14px", fontWeight: "500" }}>
                Ready: {Array.from(files).map(f => f.name).join(", ")}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginBottom: "24px", flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: colors.inputBg, padding: "8px 16px", borderRadius: "10px", border: `1px solid ${colors.border}` }}>
                <label style={{ fontSize: "13px", color: colors.textMuted, fontWeight: "600" }}>Missing Data:</label>
                <select value={missingValuesChoice} onChange={(e) => setMissingValuesChoice(e.target.value)} style={{ padding: "4px 8px", borderRadius: "6px", backgroundColor: colors.card, color: colors.text, border: `1px solid ${colors.border}`, outline: "none", fontSize: "13px" }}>
                  <option value="mean">Fill Mean</option><option value="median">Fill Median</option><option value="mode">Fill Mode</option><option value="drop">Drop Rows</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: colors.inputBg, padding: "8px 16px", borderRadius: "10px", border: `1px solid ${colors.border}` }}>
                <input type="checkbox" id="removeDupes" checked={removeDuplicatesChoice} onChange={(e) => setRemoveDuplicatesChoice(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: colors.primary }} />
                <label htmlFor="removeDupes" style={{ fontSize: "13px", color: colors.text, fontWeight: "600", cursor: "pointer" }}>Remove Duplicates</label>
              </div>
            </div>

            <button onClick={(e) => { e.stopPropagation(); handleUpload(); }} disabled={loading} style={{ padding: "14px 32px", background: colors.text, color: colors.bg, border: "none", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "15px", transition: "opacity 0.2s", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
              {loading ? "Processing via AI..." : "Analyze Datasets"}
            </button>
            {error && <p style={{ color: colors.danger, marginTop: "16px", fontSize: "14px", fontWeight: "500" }}>{error}</p>}
          </div>

          {/* SKELETON LOADERS */}
          {loading && (
             <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
                <div><Skeleton height="200px" /><Skeleton height="150px" /></div>
                <Skeleton height="400px" />
             </div>
          )}

          {/* DASHBOARD TABS */}
          {dashboards.length > 0 && !loading && (
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}>
              {dashboards.map((dash, index) => (
                <button key={index} onClick={() => setActiveIndex(index)} style={{ padding: "10px 20px", backgroundColor: activeIndex === index ? colors.text : "transparent", color: activeIndex === index ? colors.bg : colors.textMuted, border: `1px solid ${activeIndex === index ? colors.text : colors.border}`, borderRadius: "20px", cursor: "pointer", fontWeight: "600", fontSize: "14px", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                   {dash.filename}
                </button>
              ))}
            </div>
          )}

          {/* ACTIVE DASHBOARD CONTENT */}
          {currentDashboard && !loading && (
            <div style={{ animation: "fadeIn 0.5s ease-out" }} ref={reportRef} className="pdf-container">
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: "28px", fontWeight: "800" }}>{currentDashboard.filename}</h2>
                  <span style={{ color: colors.textMuted, fontSize: "14px" }}>Analyzed & Cleaned by AI Engine</span>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button onClick={downloadPDFReport} style={{ padding: "10px 20px", backgroundColor: colors.card, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export PDF
                  </button>
                  <button onClick={downloadCSV} style={{ padding: "10px 20px", backgroundColor: colors.card, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
                    Export CSV
                  </button>
                  <button onClick={clearCurrentDashboard} style={{ padding: "10px 20px", backgroundColor: colors.dangerLight, color: colors.danger, border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>Close</button>
                </div>
              </div>

              {/* VIEW 1: CHARTS */}
              {activeTab === "charts" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2.5fr", gap: "24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div style={cardStyle}>
                      <h3 style={{ margin: "0 0 20px 0", fontSize: "16px", color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Summary Stats</h3>
                      <div style={{ maxHeight: "500px", overflowY: "auto", paddingRight: "8px" }}>
                        {Object.keys(currentDashboard.stats).map(col => (
                          <div className="hover-card" key={col} style={{ marginBottom: "12px", padding: "16px", backgroundColor: colors.bg, borderRadius: "12px", border: `1px solid ${colors.border}`, cursor: "default" }}>
                            <strong style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>{col}</strong>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: colors.textMuted }}>
                              <span>μ: {currentDashboard.stats[col].mean}</span>
                              <span>σ: {currentDashboard.stats[col].std}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ ...cardStyle, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px", paddingBottom: "24px", borderBottom: `1px solid ${colors.border}`, flexWrap: "wrap", gap: "16px" }}>
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "12px", color: colors.textMuted, fontWeight: "600", textTransform: "uppercase" }}>Type</label>
                            <select value={chartType} onChange={(e) => setChartType(e.target.value)} style={{ padding: "10px 16px", borderRadius: "8px", backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, outline: "none", fontSize: "14px", fontWeight: "500" }}>
                              <option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option><option value="pie">Pie</option><option value="scatter">Scatter</option><option value="histogram">Histogram</option>
                            </select>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "12px", color: colors.textMuted, fontWeight: "600", textTransform: "uppercase" }}>Y-Axis</label>
                            <select value={selectedY} onChange={(e) => setSelectedY(e.target.value)} style={{ padding: "10px 16px", borderRadius: "8px", backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, outline: "none", fontSize: "14px", fontWeight: "500" }}>
                              {currentDashboard.numeric_columns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "12px", color: colors.textMuted, fontWeight: "600", textTransform: "uppercase" }}>X-Axis</label>
                            <select value={selectedX} onChange={(e) => setSelectedX(e.target.value)} style={{ padding: "10px 16px", borderRadius: "8px", backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, outline: "none", fontSize: "14px", fontWeight: "500" }}>
                              <option value="Row Index">Row Index</option>
                              {currentDashboard.columns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                          </div>
                        </div>
                    </div>
                    <div style={{ position: "relative", height: "450px", width: "100%", flex: 1 }}>{renderChart()}</div>
                  </div>
                </div>
              )}

              {/* VIEW 2: AI INSIGHTS */}
              {activeTab === "insights" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "24px" }}>
                  
                  {/* Health Score */}
                  <div style={{ ...cardStyle, gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid rgba(99,102,241,0.3)`, background: isDark ? "linear-gradient(to right, rgba(99,102,241,0.05), transparent)" : "#f8fafc" }}>
                    <div>
                      <h3 style={{ margin: "0 0 8px 0", color: colors.primary, fontSize: "20px" }}>Dataset Quality Index</h3>
                      <p style={{ margin: 0, color: colors.textMuted, fontSize: "14px" }}>{currentDashboard.clustering_insight}</p>
                    </div>
                    <div style={{ fontSize: "48px", fontWeight: "900", color: currentDashboard.health_score > 70 ? colors.success : colors.warning }}>
                      {currentDashboard.health_score}<span style={{fontSize: "20px", color: colors.textMuted, fontWeight: "500"}}>/100</span>
                    </div>
                  </div>

                  {/* Auto-Insights */}
                  <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
                    <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}> Generated Summary</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {currentDashboard.generated_insights && currentDashboard.generated_insights.map((text, idx) => (
                         <div className="hover-card" key={idx} style={{ padding: "16px", backgroundColor: colors.bg, borderRadius: "12px", fontSize: "15px", color: colors.text, border: `1px solid ${colors.border}`, cursor: "default" }}>
                            {text}
                         </div>
                      ))}
                    </div>
                  </div>

                  {/* Random Forest */}
                  <div style={{ ...cardStyle }}>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}> Random Forest Analysis</h3>
                    <p style={{ fontSize: "14px", color: colors.text, lineHeight: "1.6" }}>{currentDashboard.tree_insight}</p>
                    <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "rgba(99,102,241,0.05)", borderRadius: "8px", border: `1px solid rgba(99,102,241,0.1)` }}>
                      <strong style={{fontSize: "12px", color: colors.primary, textTransform: "uppercase"}}>Hypothesis</strong>
                      <p style={{margin: "4px 0 0 0", fontSize: "13px", color: colors.textMuted}}>The ML model tested thousands of decision paths to mathematically prove which specific column has the most absolute control over your target outcome.</p>
                    </div>
                  </div>

                  {/* Time Series */}
                  <div style={{ ...cardStyle }}>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}> Predictive Forecasting</h3>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                       {currentDashboard.forecasts && Object.keys(currentDashboard.forecasts).slice(0, 2).map(col => (
                         <div className="hover-card" key={col} style={{ padding: "16px", backgroundColor: colors.bg, borderRadius: "12px", flex: "1", border: `1px solid ${colors.border}`, cursor: "default" }}>
                           <strong style={{display: "block", marginBottom: "12px", fontSize: "14px"}}>{col}</strong>
                           <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", color: colors.textMuted, marginBottom: "4px"}}><span>Next interval:</span><strong style={{color: colors.text}}>{currentDashboard.forecasts[col][0]}</strong></div>
                           <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", color: colors.textMuted, marginBottom: "4px"}}><span>+2 intervals:</span><strong style={{color: colors.text}}>{currentDashboard.forecasts[col][1]}</strong></div>
                           <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", color: colors.textMuted}}><span>+3 intervals:</span><strong style={{color: colors.text}}>{currentDashboard.forecasts[col][2]}</strong></div>
                         </div>
                       ))}
                    </div>
                    <div style={{ marginTop: "20px", padding: "12px", backgroundColor: "rgba(245,158,11,0.05)", borderRadius: "8px", border: `1px solid rgba(245,158,11,0.1)` }}>
                      <strong style={{fontSize: "12px", color: colors.warning, textTransform: "uppercase"}}>Hypothesis</strong>
                      <p style={{margin: "4px 0 0 0", fontSize: "13px", color: colors.textMuted}}>If your data is recorded daily, these are the exact mathematical predictions for tomorrow, the day after, and the day after that.</p>
                    </div>
                  </div>

                  {/* Trends */}
                  <div style={{ ...cardStyle }}>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}> Macro Trends</h3>
                    {Object.keys(currentDashboard.trends).slice(0,5).map(col => (
                      <div className="hover-card" key={col} style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", fontSize: "14px", cursor: "default", borderRadius: "8px", marginBottom: "4px" }}>
                        <span style={{color: colors.textMuted}}>{col}</span><strong style={{color: colors.text}}>{currentDashboard.trends[col]}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Anomalies */}
                  <div style={{ ...cardStyle }}>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}> Statistical Outliers</h3>
                    {Object.keys(currentDashboard.stats).slice(0,5).map(col => (
                      <div className="hover-card" key={col} style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", fontSize: "14px", cursor: "default", borderRadius: "8px", marginBottom: "4px" }}>
                        <span style={{color: colors.textMuted}}>{col}</span>
                        <span style={{ color: currentDashboard.stats[col].outliers > 0 ? colors.danger : colors.success, fontWeight: "bold" }}>
                          {currentDashboard.stats[col].outliers} detected
                        </span>
                      </div>
                    ))}
                    <div style={{ marginTop: "20px", padding: "12px", backgroundColor: colors.dangerLight, borderRadius: "8px" }}>
                      <strong style={{fontSize: "12px", color: colors.danger, textTransform: "uppercase"}}>Hypothesis</strong>
                      <p style={{margin: "4px 0 0 0", fontSize: "13px", color: colors.textMuted}}>Points that break the normal pattern completely (Z-score &gt; 3). This is either a typo in your dataset or a massive real-world event.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 3: DATA GRID */}
              {activeTab === "datagrid" && (
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "18px" }}>Raw Data Explorer</h3>
                      <span style={{ fontSize: "13px", color: colors.textMuted }}>Viewing processed dataset</span>
                    </div>
                    
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                      {/* PAGINATION UI */}
                      {totalPages > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: colors.inputBg, padding: "8px 16px", borderRadius: "10px", border: `1px solid ${colors.border}` }}>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: colors.textMuted }}>Page:</span>
                          <select value={pageIndex} onChange={(e) => setPageIndex(Number(e.target.value))} style={{ padding: "4px", borderRadius: "6px", backgroundColor: colors.card, color: colors.text, border: `1px solid ${colors.border}`, outline: "none", cursor: "pointer", fontSize: "13px" }}>
                            {[...Array(totalPages)].map((_, i) => (
                              <option key={i} value={i}>
                                {i * rowsPerPage + 1} - {Math.min((i + 1) * rowsPerPage, filteredData.length)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                        <span style={{ position: "absolute", left: "14px", fontSize: "14px" }}>🔍</span>
                        <input type="text" placeholder="Search dataset..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: "10px 10px 10px 36px", borderRadius: "10px", border: `1px solid ${colors.border}`, backgroundColor: colors.inputBg, color: colors.text, outline: "none", width: "260px", fontSize: "14px" }} />
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ overflowX: "auto", borderRadius: "12px", border: `1px solid ${colors.border}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ backgroundColor: colors.bg, borderBottom: `2px solid ${colors.border}` }}>
                          {currentDashboard.columns.map(col => <th key={col} style={{ padding: "16px", color: colors.textMuted, fontWeight: "600", whiteSpace: "nowrap" }}>{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.length > 0 ? (
                           paginatedData.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: `1px solid ${colors.border}`, backgroundColor: idx % 2 === 0 ? "transparent" : colors.bg, transition: "background-color 0.2s" }} onMouseOver={e=>e.currentTarget.style.backgroundColor="rgba(99,102,241,0.05)"} onMouseOut={e=>e.currentTarget.style.backgroundColor=idx % 2 === 0 ? "transparent" : colors.bg}>
                              {currentDashboard.columns.map(col => <td key={col} style={{ padding: "12px 16px", whiteSpace: "nowrap", color: colors.text }}>{row[col]}</td>)}
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={currentDashboard.columns.length} style={{ padding: "40px", textAlign: "center", color: colors.textMuted }}>No results found for "{searchQuery}"</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* GLOBAL ANIMATIONS - ADDED HOVER CARD ZOOM */}
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .hover-card {
          transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        }
        .hover-card:hover {
          transform: translateY(-3px) scale(1.01);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          z-index: 1;
        }
      `}</style>
    </div>
  );
}

export default App;
