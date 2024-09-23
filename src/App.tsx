import React, { useState, useEffect, useCallback } from 'react';
import { QrReader } from 'react-qr-reader';
import axios from 'axios';
import { saveAs } from 'file-saver';
import './App.css';

interface Participant {
  id: string;
  name: string;
  ename: string;
  voice: string;
  isValid: boolean;
  checkIns: string[];
  signedToday: boolean;
}

// Add this interface for the participants list
interface ParticipantsList {
  [key: string]: Participant;
}

function formatToHKTime(date: Date): string {
  return date.toLocaleString('en-US', { 
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function App() {
  const [manualEntry, setManualEntry] = useState('');
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [showModeSwitch, setShowModeSwitch] = useState(false);
  const [modeSwitchPassword, setModeSwitchPassword] = useState('');
  const [activityName, setActivityName] = useState('HKACM 二維碼簽到系統');
  const [currentActivityName, setCurrentActivityName] = useState('');
  const [pendingActivityName, setPendingActivityName] = useState('');
  const [dailyCheckInCount, setDailyCheckInCount] = useState(0);
  const [lastCheckInStatus, setLastCheckInStatus] = useState('');
  const [totalPeople, setTotalPeople] = useState(0);

  // Add this state variable for storing all participants
  const [participants, setParticipants] = useState<ParticipantsList>({});

  const API_URL = 'https://192.168.0.119:3001';

  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isCameraAuthorized, setIsCameraAuthorized] = useState(false);

  const getCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error getting cameras:', error);
      setError('無法獲取攝像頭列表');
    }
  }, [selectedCamera]);

  useEffect(() => {
    getCameras();
    navigator.mediaDevices.addEventListener('devicechange', getCameras);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getCameras);
    };
  }, [getCameras]);

  const handleCameraChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCameraId = event.target.value;
    setSelectedCamera(newCameraId);
    setScanning(false); // Stop scanning when changing camera
    // Optionally, you can restart scanning after a short delay
    // setTimeout(() => setScanning(true), 1000);
  };

  const fetchParticipants = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/participants`);
      const participantsData: ParticipantsList = {};
      response.data.forEach((p: Participant) => {
        participantsData[p.id] = p;
      });
      
      // Sort participants by their latest check-in
      const sortedParticipants = Object.values(participantsData).sort((a, b) => {
        const aLatest = a.checkIns && a.checkIns.length > 0 ? new Date(a.checkIns[0]).getTime() : 0;
        const bLatest = b.checkIns && b.checkIns.length > 0 ? new Date(b.checkIns[0]).getTime() : 0;
        return bLatest - aLatest; // Sort in descending order (latest first)
      });

      const sortedParticipantsObj: ParticipantsList = {};
      sortedParticipants.forEach(p => {
        sortedParticipantsObj[p.id] = p;
      });

      setParticipants(sortedParticipantsObj);
      setError(null);
    } catch (err) {
      setError('無法獲取參與者資料。請稍後再試。');
      console.error('Error fetching participants:', err);
    }
  };

  const fetchParticipantsOnLogin = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/participants`);
      const participantsData: ParticipantsList = {};
      response.data.forEach((p: Participant) => {
        participantsData[p.id] = p;
      });
      
      // Sort participants by their latest check-in
      const sortedParticipants = Object.values(participantsData).sort((a, b) => {
        const aLatest = a.checkIns && a.checkIns.length > 0 ? new Date(a.checkIns[0]).getTime() : 0;
        const bLatest = b.checkIns && b.checkIns.length > 0 ? new Date(b.checkIns[0]).getTime() : 0;
        return bLatest - aLatest; // Sort in descending order (latest first)
      });

      const sortedParticipantsObj: ParticipantsList = {};
      sortedParticipants.forEach(p => {
        sortedParticipantsObj[p.id] = p;
      });

      setParticipants(sortedParticipantsObj);
      setTotalPeople(Object.keys(sortedParticipantsObj).length); // Update total people count
      setError(null);
    } catch (err) {
      setError('無法獲取參與者資料。請稍後再試。');
      console.error('Error fetching participants:', err);
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (manualEntry.trim()) {
      await checkParticipant(manualEntry);
      setManualEntry('');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setManualEntry(event.target.value);
  };

  const checkParticipant = useCallback(async (id: string) => {
    console.log('Checking participant with ID:', id);
    setIsLoading(true);
    try {
      const checkInTime = new Date().toISOString();
      console.log('Sending check-in request to server...');
      const response = await axios.post(`${API_URL}/api/check-in`, {
        qrData: id,
        checkInTime: checkInTime,
        isDemoMode: isDemoMode,
        activityName: currentActivityName
      });
      
      console.log('Server response:', response.data);
      if (response.data.participant) {
        const participantData: Participant = {
          ...response.data.participant,
          id: id,
          signedToday: false
        };

        // Calculate if signed today
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        participantData.signedToday = participantData.checkIns.some(checkIn => 
          new Date(checkIn) >= today
        );

        setParticipant(participantData);
        
        // Update last check-in status with ID and duplicate check info
        setLastCheckInStatus(`ID: ${id} - ${response.data.message}${response.data.isDuplicate ? ' (重複簽到)' : ''}`);
        
        // Increment the daily check-in count
        setDailyCheckInCount(response.data.dailyCheckInCount);
        setTotalPeople(response.data.totalPeople);
        await fetchParticipants();
        setManualEntry('');
      } else {
        setParticipant(null);
        setLastCheckInStatus(`ID: ${id} - ${response.data.message}`);
      }
      setError(null);
    } catch (err) {
      console.error('Error checking participant:', err);
      setLastCheckInStatus(`ID: ${id} - 檢查參與者時發生錯誤`);
      setParticipant(null);
      if (axios.isAxiosError(err) && err.response) {
        setError(`錯誤：${err.response.status} - ${err.response.data.message}`);
      } else {
        setError('發生未知錯誤');
      }
    } finally {
      setIsLoading(false);
      if (autoScan) {
        setTimeout(() => setScanning(true), 2000);
      }
    }
  }, [autoScan, currentActivityName, isDemoMode]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!file) {
      setUploadStatus('未選擇檔案');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('activityName', pendingActivityName);

    try {
      const response = await axios.post(`${API_URL}/api/upload-participants`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus('參與者資料更新成功');
      await fetchParticipants();
      setTotalPeople(response.data.totalPeople);
      setCurrentActivityName(pendingActivityName);
      setError(null);
      setShowUpdateConfirmation(false);
    } catch (err) {
      console.error('File upload error:', err);
      setUploadStatus('上傳檔案時發生錯誤');
      if (axios.isAxiosError(err) && err.response) {
        setError(`錯誤：${err.response.status} - ${JSON.stringify(err.response.data)}`);
      } else {
        setError('檔案上傳時發生未知錯誤');
      }
    }
  };

  const handleClearData = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/clear-participants`);
      setUploadStatus('所有參與者資料已成功清除');
      setParticipant(null);
      setError(null);
      setShowClearConfirmation(false);
      setParticipants({});
      setTotalPeople(response.data.totalPeople);
    } catch (err) {
      setUploadStatus('清除參與者資料時發生錯誤');
      if (axios.isAxiosError(err) && err.response) {
        setError(`錯誤：${err.response.status} - ${err.response.data}`);
      } else {
        setError('清除資料時發生未知錯誤');
      }
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password === 'hkacmadmin') {
      setIsAuthenticated(true);
      await fetchParticipantsOnLogin(); // Fetch participants data on successful login
      await fetchTotalPeople(); // Fetch total number of people
    } else {
      setError('密碼錯誤');
    }
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    setPassword('');
    setParticipants({}); // Clear participants data on logout
  };

  const handleExportExcel = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/export-checkins`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Generate filename with activity name, app name, date, and time
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
      const fileName = `${currentActivityName || 'Unnamed_Activity'}_${activityName}_${dateStr}_${timeStr}.xlsx`;
      
      saveAs(blob, fileName);
      setError(null);
    } catch (err) {
      setError('匯出簽到記錄時發生錯誤');
      console.error('Error exporting check-ins:', err);
    }
  };

  const handleModeSwitchClick = () => {
    setShowModeSwitch(true);
  };

  const handleModeSwitchPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModeSwitchPassword(event.target.value);
  };

  const handleModeSwitchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (modeSwitchPassword === 'hkacmadmin') {
      try {
        const newMode = !isDemoMode;
        const response = await axios.post(`${API_URL}/api/set-demo-mode`, { isDemoMode: newMode });
        if (response.data.success) {
          setIsDemoMode(newMode);
          setShowModeSwitch(false);
          setModeSwitchPassword('');
          setError(null);
          setLastCheckInStatus(`已切換至${newMode ? '演示' : '正式'}模式`);
        } else {
          setError('切換模式失敗。請稍後再試。');
        }
      } catch (err) {
        setError('切換模式時發生錯誤。請稍後再試。');
        console.error('Error switching modes:', err);
      }
    } else {
      setError('模式切換密碼錯誤');
    }
  };

  const toggleAutoScan = () => {
    setAutoScan(!autoScan);
    if (!autoScan) {
      setScanning(true);
      setIsPreviewVisible(true);
    }
  };

  const handleActivityNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setActivityName(event.target.value);
  };

  const handleCurrentActivityNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPendingActivityName(event.target.value);
  };

  const fetchTotalPeople = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/total-people`);
      setTotalPeople(response.data.totalPeople);
    } catch (error) {
      console.error('Error fetching total number of people:', error);
    }
  };

  const toggleScanning = () => {
    if (scanning) {
      setScanning(false);
      setIsPreviewVisible(false);
    } else {
      setScanning(true);
      setIsPreviewVisible(true);
    }
  };

  const handleScan = useCallback((result: any) => {
    if (result) {
      const scannedText = result.getText();
      console.log('Scan result:', scannedText);
      checkParticipant(scannedText);
      if (!autoScan) {
        setScanning(false);
        setIsPreviewVisible(false);
      }
    }
  }, [autoScan, checkParticipant]);

  const handleCameraAuthorization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
      setIsCameraAuthorized(true);
      setError(null);
    } catch (error) {
      console.error('Error authorizing camera:', error);
      setError('無法獲取攝像頭權限。請確保您已授予攝像頭訪問權限。');
      setIsCameraAuthorized(false);
    }
  };

  const fetchDailyCheckInCount = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/daily-check-in-count`);
      setDailyCheckInCount(response.data.dailyCheckInCount);
    } catch (error) {
      console.error('Error fetching daily check-in count:', error);
      setError('無法獲取今日總簽到次數');
    }
  };

  const handleResetDailyCheckInCount = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/reset-daily-check-in-count`);
      if (response.data.success) {
        setDailyCheckInCount(0);
        setLastCheckInStatus('今日總簽到次數已重置');
      } else {
        setError('重置今日總簽到次數失敗');
      }
    } catch (err) {
      setError('重置今日總簽到次數時發生錯誤');
      console.error('Error resetting daily check-in count:', err);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      await fetchTotalPeople();
      await fetchDailyCheckInCount();
      await fetchCurrentActivity();
    };

    fetchInitialData();

    // Fetch total people and daily check-in count every 5 minutes
    const intervalId = setInterval(() => {
      fetchTotalPeople();
      fetchDailyCheckInCount();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchCurrentActivity = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/current-activity`);
      setCurrentActivityName(response.data.currentActivityName);
      setPendingActivityName(response.data.currentActivityName);
    } catch (error) {
      console.error('Error fetching current activity:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>{activityName}</h1>
        <h2>{currentActivityName || '未設定當前活動'}</h2>
        <div className="mode-switch">
          <span>目前模式：{isDemoMode ? '演示' : '正式'}</span>
          <button onClick={handleModeSwitchClick} className="mode-switch-button">
            切換至{isDemoMode ? '正式' : '演示'}模式
          </button>
        </div>
      </header>
      
      <main className="App-main">
        {error && <div className="error-message">{error}</div>}

        {showModeSwitch && (
          <div className="modal mode-switch-confirmation">
            <div className="modal-content">
              <h3>確認模式切換</h3>
              <p>請輸入管理員密碼以切換至{isDemoMode ? '正式' : '演示'}模式：</p>
              <form onSubmit={handleModeSwitchSubmit} className="mode-switch-form">
                <input
                  type="password"
                  value={modeSwitchPassword}
                  onChange={handleModeSwitchPasswordChange}
                  placeholder="輸入管理員密碼"
                  className="input-field"
                />
                <div className="button-group">
                  <button type="submit" className="submit-button">確認切換</button>
                  <button onClick={() => setShowModeSwitch(false)} className="cancel-button">取消</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section className="check-in-section">
          <h2>簽到</h2>
          <form onSubmit={handleManualSubmit} className="check-in-form">
            <input
              type="text"
              value={manualEntry}
              onChange={handleInputChange}
              placeholder="手動輸入參與者ID或掃描二維碼"
              className="input-field"
            />
            <button type="submit" className="submit-button">提交</button>
          </form>

          <div className="qr-scanner-section">
            <p className="status-message">最後簽到狀態：{lastCheckInStatus}</p>
            
            <select 
              value={selectedCamera || ''} 
              onChange={handleCameraChange}
              disabled={scanning}
            >
              {cameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${camera.deviceId}`}
                </option>
              ))}
            </select>
            
            <div className="scanner-container" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
              {isPreviewVisible && (
                <QrReader
                  key={selectedCamera}
                  onResult={handleScan}
                  constraints={{ deviceId: selectedCamera || undefined, facingMode: 'environment' }}
                  videoStyle={{ width: '100%', height: 'auto', maxHeight: '80vh' }}
                  containerStyle={{ width: '100%', height: 'auto' }}
                  videoContainerStyle={{ width: '100%', height: 'auto', paddingTop: '75%', position: 'relative' }}
                />
              )}
            </div>
            <div className="scanner-controls">
              <button onClick={handleCameraAuthorization} className="authorize-camera-button">
                授權攝像頭
              </button>
              <button 
                onClick={toggleScanning} 
                className={scanning ? "stop-scan-button" : "scan-button"}
                disabled={!isCameraAuthorized}
              >
                {scanning ? '停止掃描' : '開始掃描'}
              </button>
              <button 
                onClick={toggleAutoScan} 
                className={`auto-scan-button ${autoScan ? 'active' : ''}`}
                disabled={!isCameraAuthorized}
              >
                {autoScan ? '關閉自動掃描' : '開啟自動掃描'}
              </button>
            </div>
          </div>

          <p className="check-in-count">今日總簽到次數：{dailyCheckInCount}</p>
          <p className="total-people">總人數：{totalPeople}</p>

          {isLoading && <p className="loading-message">載入中...</p>}
        </section>

        {participant && (
          <section className="participant-info">
            <h2>參與者資訊</h2>
            <table className="info-table">
              <tbody>
                <tr>
                  <td><strong>ID</strong></td>
                  <td>{participant.id}</td>
                  <td><strong>狀態</strong></td>
                  <td>{participant.isValid ? '有效' : '無效'}</td>
                </tr>
                <tr>
                  <td><strong>中文姓名</strong></td>
                  <td>{participant.name}</td>
                  <td><strong>英文姓名</strong></td>
                  <td>{participant.ename}</td>
                </tr>
                <tr>
                  <td><strong>聲部</strong></td>
                  <td>{participant.voice}</td>
                  <td><strong>今日已簽到</strong></td>
                  <td>{participant.signedToday ? '是' : '否'}</td>
                </tr>
              </tbody>
            </table>
            {participant.checkIns && participant.checkIns.length > 0 && (
              <div className="check-ins">
                <h3>簽到記錄</h3>
                <table className="check-in-history-table">
                  <thead>
                    <tr>
                      <th>序號</th>
                      <th>簽到時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participant.checkIns.map((checkIn, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{formatToHKTime(new Date(checkIn))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <section className="auth-section">
        <div className="login-container">
          <h2>管理員登入</h2>
          {!isAuthenticated ? (
            <form onSubmit={handlePasswordSubmit} className="login-form">
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="輸入管理員密碼"
                className="input-field"
              />
              <button type="submit" className="submit-button">登入</button>
            </form>
          ) : (
            <div className="admin-section">
              <div className="section-header">
                <h3>管理員功能</h3>
                <button onClick={handleLock} className="lock-button">鎖定</button>
              </div>
              <div className="admin-controls">
                <input
                  type="text"
                  value={activityName}
                  onChange={handleActivityNameChange}
                  placeholder="輸入系統名稱"
                  className="input-field"
                />
                <input
                  type="text"
                  value={pendingActivityName}
                  onChange={handleCurrentActivityNameChange}
                  placeholder="輸入當前活動名稱"
                  className="input-field"
                />
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".xlsx,.xls"
                  className="file-input"
                />
                <button onClick={() => setShowUpdateConfirmation(true)} className="upload-button">上傳 Excel 檔案</button>
                <button onClick={() => setShowClearConfirmation(true)} className="clear-button">清除所有資料</button>
                <button onClick={handleExportExcel} className="export-button">匯出簽到記錄</button>
                <button onClick={handleResetDailyCheckInCount} className="reset-button">重置今日總簽到次數</button>
              </div>
              <p className="upload-status">{uploadStatus}</p>
              {showUpdateConfirmation && (
                <div className="modal update-confirmation">
                  <div className="modal-content">
                    <h3>確認更新</h3>
                    <p>您確定要上傳新的參與者資料嗎？這將會覆蓋現有的資料。</p>
                    <div className="button-group">
                      <button onClick={handleFileUpload} className="confirm-update-button">確認</button>
                      <button onClick={() => setShowUpdateConfirmation(false)} className="cancel-update-button">取消</button>
                    </div>
                  </div>
                </div>
              )}
              {showClearConfirmation && (
                <div className="modal clear-confirmation">
                  <div className="modal-content">
                    <h3>確認清除</h3>
                    <p>您確定要清除所有參與者資料嗎？此操作無法撤銷。</p>
                    <div className="button-group">
                      <button onClick={handleClearData} className="confirm-clear-button">確認</button>
                      <button onClick={() => setShowClearConfirmation(false)} className="cancel-clear-button">取消</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {isAuthenticated && (
        <section className="participant-table">
          <h2>參與者列表</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>序號</th>
                  <th>ID</th>
                  <th>中文姓名</th>
                  <th>英文姓名</th>
                  <th>聲部</th>
                  <th>狀態</th>
                  <th>今日已簽到</th>
                  <th>簽到記錄</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(participants).map((p: Participant, index: number) => {
                  // Calculate if signed today
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const signedToday = p.checkIns.some(checkIn => 
                    new Date(checkIn) >= today
                  );

                  return (
                    <tr key={p.id}>
                      <td>{index + 1}</td>
                      <td>{p.id}</td>
                      <td>{p.name}</td>
                      <td>{p.ename}</td>
                      <td>{p.voice}</td>
                      <td>{p.isValid ? '有效' : '無效'}</td>
                      <td>{signedToday ? '是' : '否'}</td>
                      <td>
                        {p.checkIns && p.checkIns.length > 0 ? (
                          <ul className="check-in-list">
                            {p.checkIns.map((checkIn, index) => (
                              <li key={index}>{formatToHKTime(new Date(checkIn))}</li>
                            ))}
                          </ul>
                        ) : '未簽到'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;