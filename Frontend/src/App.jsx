import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Signup from './components/Signup/Signup';
import Login from './components/Login/Login';
import Home from './components/Home/Home';
import Dashboard from './components/Dashboard/Dashboard';
import Upload from './components/Upload/Upload';
import Chat from './components/Chat/Chat';
import Settings from './components/Settings/Settings';
import Logout from './components/Logout/Logout';
import Contact from './components/Contact/Contact';
import Training from './components/Training/Training';
import Reports from './components/Reports/Reports';

function App() {
  return (
    <Router>
      <UserProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/logout" element={<Logout />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/training" element={<Training />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/:reportId" element={<Reports />} />
      </Routes>
      </UserProvider>
    </Router>
  );
}



export default App;

