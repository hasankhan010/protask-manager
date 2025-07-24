import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  getDoc
} from 'firebase/firestore';

// Lucide React Icons for a clean, modern look
import { Plus, Edit, Trash2, XCircle, Calendar, Tag, AlertCircle, LayoutDashboard, ListTodo, User, Sun, Moon, Sparkles, CircleDashed, CircleCheck, Gauge, LogIn, UserPlus, Mail, LogOut, Search, ChevronDown, Settings, Clock } from 'lucide-react';

// Simplified Dialog component for modals (Add/Edit Task, Auth Forms, Profile Edit)
const Dialog = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 relative transform scale-95 opacity-0 animate-scale-in">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <XCircle size={24} />
          </button>
        </div>
        <div className="py-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Custom Confirmation Dialog component
const ConfirmationDialog = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6 relative transform scale-95 opacity-0 animate-scale-in">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Confirm Action</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <XCircle size={24} />
          </button>
        </div>
        <div className="py-6 text-gray-700 dark:text-gray-200">
          <p>{message}</p>
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow-md transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // Firebase User object
  const [username, setUsername] = useState('Guest'); // Displayed username
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false); // Task Add/Edit Dialog
  const [currentTask, setCurrentTask] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskCategory, setTaskCategory] = useState('');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  const [activeTab, setActiveTab] = useState('tasks');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [onConfirmAction, setOnConfirmAction] = useState(() => () => {});

  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'forgotPassword'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authError, setAuthError] = useState('');

  const [tasks, setTasks] = useState([]); // Moved here for better scope access in useEffect

  // New states for advanced filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortCriteria, setSortCriteria] = useState('dueDate'); // 'dueDate', 'priority', 'createdAt'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [filterDateRange, setFilterDateRange] = useState('All'); // 'All', 'Today', 'Past', 'Custom'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');


  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [profileError, setProfileError] = useState('');


  // Effect to manage dark mode class on HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Initialize Firebase and handle authentication
  useEffect(() => {
    try {
      // Your Firebase configuration directly embedded here
      // IMPORTANT: For production apps, consider using environment variables for security.
      const firebaseConfig = {
        apiKey: "AIzaSyC50RY_T_LKHs7J3fNEl0_e2l_EVidgSjg",
        authDomain: "protask-bebc6.firebaseapp.com",
        projectId: "protask-bebc6",
        storageBucket: "protask-bebc6.firebasestorage.app",
        messagingSenderId: "707087494987",
        appId: "1:707087494987:web:6c5c74b8966c7f461082ce",
        measurementId: "G-FD14PGRNCH"
      };

      const appId = firebaseConfig.projectId; // Use projectId as appId for consistency with Firestore paths

      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      // Log network status for debugging
      console.log("Navigator is online:", navigator.onLine);
      window.addEventListener('online', () => console.log('Went online!'));
      window.addEventListener('offline', () => console.log('Went offline!'));


      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setCurrentUser(user);
          // Fetch user's profile to get username
          const userProfileRef = doc(firestoreDb, `artifacts/${appId}/users/${user.uid}/profile/data`);
          const docSnap = await getDoc(userProfileRef);
          if (docSnap.exists()) {
            setUsername(docSnap.data().username || user.email || 'User');
          } else {
            // If profile data doesn't exist, use email and create profile data
            setUsername(user.email || 'User');
            await setDoc(userProfileRef, { username: user.email || 'User', email: user.email, createdAt: serverTimestamp() }, { merge: true });
          }
          setIsAuthReady(true);
        } else {
          setCurrentUser(null);
          setUsername('Guest');
          setIsAuthReady(true);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Fetch tasks when auth is ready and currentUser is available
  useEffect(() => {
    if (db && currentUser && isAuthReady) {
      const currentAppId = auth.app.options.projectId;
      const tasksCollectionRef = collection(db, `artifacts/${currentAppId}/users/${currentUser.uid}/tasks`);
      // We'll do sorting and filtering in memory for flexibility, as Firestore orderBy has limitations
      const q = query(tasksCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTasks(fetchedTasks); // Set unsorted/unfiltered tasks
      }, (error) => {
        console.error("Error fetching tasks:", error);
      });

      return () => unsubscribe();
    } else if (isAuthReady && !currentUser) {
        setTasks([]);
    }
  }, [db, currentUser, isAuthReady, auth]);

  // Reset task form fields
  const resetForm = () => {
    setTaskTitle('');
    setTaskDescription('');
    setTaskCategory('');
    setTaskPriority('Medium');
    setTaskDueDate('');
    setCurrentTask(null);
  };

  // Open task form for adding or editing
  const openTaskForm = (task = null) => {
    if (!currentUser) {
      setAuthError("Please log in or sign up to add/edit tasks.");
      setIsAuthDialogOpen(true);
      setAuthMode('login');
      return;
    }
    setCurrentTask(task);
    if (task) {
      setTaskTitle(task.title);
      setTaskDescription(task.description || '');
      setTaskCategory(task.category || '');
      setTaskPriority(task.priority || 'Medium');
      setTaskDueDate(task.dueDate || '');
    } else {
      resetForm();
    }
    setIsFormOpen(true);
  };

  // Close task form
  const closeTaskForm = () => {
    setIsFormOpen(false);
    resetForm();
  };

  // Handle form submission (Add/Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !currentUser) {
      console.error("Firestore not initialized or user not authenticated.");
      return;
    }
    const currentAppId = auth.app.options.projectId;

    const taskData = {
      title: taskTitle,
      description: taskDescription,
      category: taskCategory,
      priority: taskPriority,
      dueDate: taskDueDate,
      status: currentTask ? currentTask.status : 'Pending',
      createdAt: currentTask ? currentTask.createdAt : serverTimestamp(),
    };

    try {
      if (currentTask) {
        const taskDocRef = doc(db, `artifacts/${currentAppId}/users/${currentUser.uid}/tasks`, currentTask.id);
        await updateDoc(taskDocRef, taskData);
        console.log("Task updated successfully!");
      } else {
        const tasksCollectionRef = collection(db, `artifacts/${currentAppId}/users/${currentUser.uid}/tasks`);
        await addDoc(tasksCollectionRef, taskData);
        console.log("Task added successfully!");
      }
      closeTaskForm();
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  // Toggle task status (Pending/Completed)
  const toggleTaskStatus = async (taskId, currentStatus) => {
    if (!db || !currentUser) {
      setAuthError("Please log in to update task status.");
      setIsAuthDialogOpen(true);
      setAuthMode('login');
      return;
    }
    const currentAppId = auth.app.options.projectId;
    try {
      const taskDocRef = doc(db, `artifacts/${currentAppId}/users/${currentUser.uid}/tasks`, taskId);
      const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
      await updateDoc(taskDocRef, { status: newStatus });
      console.log(`Task status toggled to ${newStatus}`);
    } catch (error) {
      console.error("Error toggling task status:", error);
    }
  };

  // Delete task with custom confirmation
  const handleDeleteTask = (taskId) => {
    if (!currentUser) {
      setAuthError("Please log in to delete tasks.");
      setIsAuthDialogOpen(true);
      setAuthMode('login');
      return;
    }
    setConfirmMessage("Are you sure you want to delete this task? This action cannot be undone.");
    setOnConfirmAction(() => async () => {
      if (!db || !currentUser) return;
      const currentAppId = auth.app.options.projectId;
      try {
        const taskDocRef = doc(db, `artifacts/${currentAppId}/users/${currentUser.uid}/tasks`, taskId);
        await deleteDoc(taskDocRef);
        console.log("Task deleted successfully!");
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    });
    setIsConfirmOpen(true);
  };

  // Dashboard data calculation
  const getDashboardData = useCallback(() => {
    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    const priorityCounts = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});

    const categoryCounts = tasks.reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {});

    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    const totalTasks = tasks.length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { statusCounts, priorityCounts, categoryCounts, completionPercentage, totalTasks };
  }, [tasks]);

  const { statusCounts, priorityCounts, categoryCounts, completionPercentage, totalTasks } = getDashboardData();

  // Helper to determine priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'High': return 'text-red-600 dark:text-red-400';
      case 'Medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'Low': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // Helper to determine priority dot color
  const getPriorityDotColor = (priority) => {
    switch (priority) {
      case 'High': return 'bg-red-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  // Helper to check if a task is overdue
  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'Completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to start of day
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0); // Normalize due date to start of day
    return due < today;
  };

  // --- Advanced Filtering and Sorting Logic ---
  const getFilteredAndSortedTasks = useCallback(() => {
    let filtered = tasks;

    // 1. Filter by Status
    if (filterStatus !== 'All') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    // 2. Filter by Category
    if (filterCategory !== 'All') {
      filtered = filtered.filter(task => task.category === filterCategory);
    }

    // 3. Filter by Search Query
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        task =>
          task.title.toLowerCase().includes(lowerCaseQuery) ||
          (task.description && task.description.toLowerCase().includes(lowerCaseQuery))
      );
    }

    // 4. Filter by Date Range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filterDateRange === 'Today') {
      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        const taskDue = new Date(task.dueDate);
        taskDue.setHours(0, 0, 0, 0);
        return taskDue.getTime() === today.getTime();
      });
    } else if (filterDateRange === 'Past') {
      filtered = filtered.filter(task => {
        if (!task.dueDate || task.status === 'Completed') return false; // Only show pending past tasks
        const taskDue = new Date(task.dueDate);
        taskDue.setHours(0, 0, 0, 0);
        return taskDue.getTime() < today.getTime();
      });
    } else if (filterDateRange === 'Custom') {
        const start = filterStartDate ? new Date(filterStartDate) : null;
        const end = filterEndDate ? new Date(filterEndDate) : null;

        filtered = filtered.filter(task => {
            if (!task.dueDate) return false;
            const taskDue = new Date(task.dueDate);
            taskDue.setHours(0, 0, 0, 0); // Normalize to start of day

            let matchesStart = true;
            if (start) {
                start.setHours(0, 0, 0, 0);
                matchesStart = taskDue.getTime() >= start.getTime();
            }

            let matchesEnd = true;
            if (end) {
                end.setHours(23, 59, 59, 999); // Normalize to end of day
                matchesEnd = taskDue.getTime() <= end.getTime();
            }
            return matchesStart && matchesEnd;
        });
    }


    // 5. Sort
    filtered.sort((a, b) => {
      // Always prioritize pending tasks over completed tasks for display
      if (a.status === 'Completed' && b.status !== 'Completed') return 1;
      if (a.status !== 'Completed' && b.status === 'Completed') return -1;

      let compareValue = 0;

      if (sortCriteria === 'dueDate') {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity; // Tasks without due date go last
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        compareValue = dateA - dateB;
      } else if (sortCriteria === 'priority') {
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        compareValue = priorityOrder[b.priority] - priorityOrder[a.priority]; // High to Low by default
      } else if (sortCriteria === 'createdAt') {
        const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0;
        compareValue = dateB - dateA; // Newest first by default
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [tasks, filterStatus, filterCategory, searchQuery, sortCriteria, sortOrder, filterDateRange, filterStartDate, filterEndDate]);

  const displayedTasks = getFilteredAndSortedTasks();

  // Get unique categories for filter dropdown
  const uniqueCategories = useCallback(() => {
    const categories = new Set();
    tasks.forEach(task => {
      if (task.category) categories.add(task.category);
    });
    return ['All', ...Array.from(categories).sort()];
  }, [tasks]);

  // --- Authentication Handlers ---
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!auth || !db) return;
    const currentAppId = auth.app.options.projectId;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      const userProfileRef = doc(db, `artifacts/${currentAppId}/users/${userCredential.user.uid}/profile/data`);
      await setDoc(userProfileRef, { username: authUsername, email: authEmail, createdAt: serverTimestamp() });
      setIsAuthDialogOpen(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthUsername('');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered. Please log in or use a different email.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters.');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      }
      else {
        setAuthError(error.message);
      }
      console.error("Signup error:", error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!auth) return;
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      setIsAuthDialogOpen(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError('Invalid email or password. Please check your credentials or use "Forgot Password?".');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else {
        setAuthError(error.message);
      }
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!auth) return;
    try {
      await sendPasswordResetEmail(auth, authEmail);
      setAuthError("Password reset email sent! Check your inbox.");
      setAuthEmail('');
    } catch (error) {
      setAuthError(error.message);
      console.error("Password reset error:", error);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      console.log("User logged out.");
      setTasks([]); // Clear tasks on logout
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const openAuthDialog = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthEmail('');
    setAuthPassword('');
    setAuthUsername('');
    setIsAuthDialogOpen(true);
  };

  // --- Profile Management ---
  const openProfileEdit = () => {
    if (currentUser) {
      setNewUsername(username); // Pre-fill with current username
      setProfileError('');
      setIsProfileEditOpen(true);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    if (!currentUser || !db) return;

    try {
      // Update Firebase Auth profile display name
      await updateProfile(currentUser, { displayName: newUsername });

      // Update username in Firestore profile data
      const userProfileRef = doc(db, `artifacts/${auth.app.options.projectId}/users/${currentUser.uid}/profile/data`);
      await updateDoc(userProfileRef, { username: newUsername });

      setUsername(newUsername); // Update local state
      setIsProfileEditOpen(false); // Close dialog
      console.log("Profile updated successfully!");
    } catch (error) {
      setProfileError(error.message);
      console.error("Error updating profile:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 font-inter antialiased flex flex-col transition-colors duration-300">
      {/* Tailwind CSS Customizations and Animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .font-inter {
          font-family: 'Inter', sans-serif;
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .animate-scale-in {
          animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .task-card-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* lg shadow */
        }
      `}</style>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-lg p-4 flex items-center justify-between sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center space-x-2">
          <Sparkles size={28} className="text-yellow-500" />
          <span>ProTask</span>
        </h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-5 py-2 rounded-full font-semibold flex items-center space-x-2 transition-all duration-300 transform hover:scale-105
              ${activeTab === 'tasks' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700'}
            `}
          >
            <ListTodo size={20} />
            <span>Tasks</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-2 rounded-full font-semibold flex items-center space-x-2 transition-all duration-300 transform hover:scale-105
              ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-700'}
            `}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
          </button>

          {currentUser ? (
            <>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full shadow-inner">
                <User size={16} className="mr-1" />
                <span>Hello, {username}!</span>
              </div>
              <button
                onClick={openProfileEdit}
                className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Edit Profile"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-full font-medium flex items-center space-x-2 bg-red-500 text-white hover:bg-red-600 transition-colors duration-200"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => openAuthDialog('login')}
                className="px-4 py-2 rounded-full font-medium flex items-center space-x-2 bg-indigo-500 text-white hover:bg-indigo-600 transition-colors duration-200"
              >
                <LogIn size={18} />
                <span>Login</span>
              </button>
              <button
                onClick={() => openAuthDialog('signup')}
                className="px-4 py-2 rounded-full font-medium flex items-center space-x-2 border border-indigo-500 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors duration-200"
              >
                <UserPlus size={18} />
                <span>Sign Up</span>
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        {activeTab === 'tasks' && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">My Tasks</h2>
              <button
                onClick={() => openTaskForm()}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg flex items-center space-x-2 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <Plus size={22} />
                <span>Add New Task</span>
              </button>
            </div>

            {/* Search, Filter & Sort Controls */}
            <div className="mb-8 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-inner flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 flex-wrap md:space-x-6 lg:space-x-8 gap-y-4"> {/* Added more spacing */}
              {/* Search Input */}
              <div className="relative flex-1 min-w-[180px]">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>

              {/* Status Filters */}
              <div className="flex space-x-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => setFilterStatus('All')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${filterStatus === 'All' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('Pending')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 flex items-center space-x-1 ${filterStatus === 'Pending' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-orange-100 dark:hover:bg-orange-900/30'}`}
                >
                  <CircleDashed size={14} /> <span>In Process</span>
                </button>
                <button
                  onClick={() => setFilterStatus('Completed')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 flex items-center space-x-1 ${filterStatus === 'Completed' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30'}`}
                >
                  <CircleCheck size={14} /> <span>Completed</span>
                </button>
              </div>

              {/* Category Filter */}
              <div className="relative min-w-[150px]">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="appearance-none pr-8 pl-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100 text-sm"
                >
                  {uniqueCategories().map(cat => (
                    <option key={cat} value={cat}>{cat === '' ? 'Uncategorized' : cat}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Date Range Filter */}
              <div className="relative min-w-[150px]">
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value)}
                  className="appearance-none pr-8 pl-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100 text-sm"
                >
                  <option value="All">All Dates</option>
                  <option value="Today">Due Today</option>
                  <option value="Past">Past Due</option>
                  <option value="Custom">Custom Date Range</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Custom Date Range Inputs (conditionally rendered) */}
              {filterDateRange === 'Custom' && (
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100 text-sm"
                    title="Start Date"
                  />
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100 text-sm"
                    title="End Date"
                  />
                </div>
              )}

              {/* Sort By */}
              <div className="relative min-w-[150px]">
                <select
                  value={sortCriteria}
                  onChange={(e) => setSortCriteria(e.target.value)}
                  className="appearance-none pr-8 pl-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100 text-sm"
                >
                  <option value="dueDate">Sort by Due Date</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="createdAt">Sort by Creation Date</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-200 text-sm"
                title={`Sort order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </button>
            </div>


            {displayedTasks.length === 0 && currentUser ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-lg">
                {filterStatus === 'All' && "No tasks yet. Let's get productive! Click 'Add New Task' to begin."}
                {filterStatus === 'Pending' && "No tasks in process. Time to add some new goals!"}
                {filterStatus === 'Completed' && "No completed tasks yet. Keep up the great work!"}
                {(searchQuery || filterCategory !== 'All' || filterDateRange !== 'All') && "No tasks match your current filters."}
              </p>
            ) : !currentUser ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-lg">
                    Please log in or sign up to manage your tasks.
                </p>
            ) : (
              <div className="space-y-5">
                {displayedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start bg-gray-50 dark:bg-gray-700 p-5 rounded-xl shadow-md transition-all duration-300 border-l-6 task-card-hover
                      ${task.status === 'Completed' ? 'opacity-80 line-through text-gray-500 dark:text-gray-400 border-green-500' : 'border-indigo-500'}
                      ${isOverdue(task.dueDate, task.status) && task.status !== 'Completed' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={task.status === 'Completed'}
                      onChange={() => toggleTaskStatus(task.id, task.status)}
                      className="form-checkbox h-6 w-6 text-indigo-600 dark:text-indigo-400 rounded-full border-gray-300 dark:border-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400 mr-5 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                        {task.dueDate && (
                          <span className={`flex items-center ${isOverdue(task.dueDate, task.status) && task.status !== 'Completed' ? 'text-red-600 dark:text-red-500 font-semibold' : ''}`}>
                            <Calendar size={16} className="mr-1.5" />
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        {task.category && (
                          <span className="flex items-center bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-medium">
                            <Tag size={14} className="mr-1" />
                            {task.category}
                          </span>
                        )}
                        {task.priority && (
                          <span className={`flex items-center font-semibold text-xs px-2 py-0.5 rounded-full ${getPriorityColor(task.priority).replace('text-', 'bg-').replace('dark:text-', 'dark:bg-').replace('600', '100').replace('500', '100')} ${getPriorityColor(task.priority)}`}>
                            <span className={`w-2 h-2 rounded-full ${getPriorityDotColor(task.priority)} mr-1`}></span>
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => openTaskForm(task)}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-indigo-600 dark:text-indigo-400 transition-colors duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        title="Edit Task"
                      >
                        <Edit size={22} />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400 transition-colors duration-200 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500"
                        title="Delete Task"
                      >
                        <Trash2 size={22} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'dashboard' && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-8">Task Dashboard</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Overall Progress Overview */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl shadow-md transition-all duration-200 hover:shadow-lg col-span-full lg:col-span-1">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center text-lg">
                  <Gauge size={20} className="mr-2 text-blue-500" />
                  Overall Progress
                </h3>
                {totalTasks === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">Add tasks to see your progress!</p>
                ) : (
                  <>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-4 mb-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-400 to-blue-500 h-4 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${completionPercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-2xl font-bold text-center text-indigo-600 dark:text-indigo-400 mb-2">
                      {completionPercentage}% Completed
                    </p>
                    <p className="text-sm text-center text-gray-600 dark:text-gray-300">
                      You have completed {statusCounts.Completed || 0} out of {totalTasks} tasks. Keep up the great work!
                    </p>
                  </>
                )}
              </div>

              {/* Status Overview */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl shadow-md transition-all duration-200 hover:shadow-lg">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center text-lg">
                  <ListTodo size={20} className="mr-2 text-indigo-500" />
                  Tasks by Status
                </h3>
                <ul className="space-y-3">
                  <li className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Pending:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400 text-xl">{statusCounts.Pending || 0}</span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Completed:</span>
                    <span className="font-bold text-green-600 dark:text-green-400 text-xl">{statusCounts.Completed || 0}</span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600 dark:text-gray-300 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <span className="font-medium">Total Tasks:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-xl">{totalTasks}</span>
                  </li>
                </ul>
              </div>

              {/* Priority Overview */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl shadow-md transition-all duration-200 hover:shadow-lg">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center text-lg">
                  <AlertCircle size={20} className="mr-2 text-yellow-500" />
                  Tasks by Priority
                </h3>
                <ul className="space-y-3">
                  <li className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span className="font-medium">High:</span>
                    <span className="font-bold text-red-600 text-xl">{priorityCounts.High || 0}</span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Medium:</span>
                    <span className="font-bold text-yellow-600 text-xl">{priorityCounts.Medium || 0}</span>
                  </li>
                  <li className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Low:</span>
                    <span className="font-bold text-green-600 text-xl">{priorityCounts.Low || 0}</span>
                  </li>
                </ul>
              </div>

              {/* Category Overview */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-xl shadow-md transition-all duration-200 hover:shadow-lg">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center text-lg">
                  <Tag size={20} className="mr-2 text-purple-500" />
                  Tasks by Category
                </h3>
                <ul className="space-y-3">
                  {Object.entries(categoryCounts).length === 0 ? (
                    <li className="text-gray-500 dark:text-gray-400">No categories defined.</li>
                  ) : (
                    Object.entries(categoryCounts).map(([category, count]) => (
                      <li key={category} className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                        <span className="font-medium">{category || 'Uncategorized'}:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xl">{count}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Task Add/Edit Dialog */}
      <Dialog
        isOpen={isFormOpen}
        onClose={closeTaskForm}
        title={currentTask ? 'Edit Task' : 'Add New Task'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Title</label>
            <input
              type="text"
              id="title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description (Optional)</label>
            <textarea
              id="description"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              rows="3"
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
            ></textarea>
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Category (e.g., Work, Personal)</label>
            <input
              type="text"
              id="category"
              value={taskCategory}
              onChange={(e) => setTaskCategory(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
            />
          </div>
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Priority</label>
            <select
              id="priority"
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Due Date (Optional)</label>
            <input
              type="date"
              id="dueDate"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={closeTaskForm}
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition-colors duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currentTask ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Authentication Dialog (Login, Signup, Forgot Password) */}
      <Dialog
        isOpen={isAuthDialogOpen}
        onClose={() => setIsAuthDialogOpen(false)}
        title={
          authMode === 'login' ? 'Login to ProTask' :
          authMode === 'signup' ? 'Sign Up for ProTask' :
          'Reset Password'
        }
      >
        <form onSubmit={
          authMode === 'login' ? handleLogin :
          authMode === 'signup' ? handleSignUp :
          handlePasswordReset
        } className="space-y-5">
          {authMode === 'signup' && (
            <div>
              <label htmlFor="authUsername" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Username</label>
              <input
                type="text"
                id="authUsername"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="authEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
            <input
              type="email"
              id="authEmail"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
              required
            />
          </div>
          {authMode !== 'forgotPassword' && (
            <div>
              <label htmlFor="authPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
            <input
              type="password"
              id="authPassword"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
              required={authMode !== 'forgotPassword'}
            />
          </div>
        )}

        {authError && (
          <p className="text-red-500 text-sm">{authError}</p>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => setIsAuthDialogOpen(false)}
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition-colors duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {authMode === 'login' ? 'Login' :
             authMode === 'signup' ? 'Sign Up' :
             'Send Reset Email'}
          </button>
        </div>

        {authMode === 'login' && (
          <p className="text-center text-sm mt-4">
            Don't have an account?{' '}
            <button type="button" onClick={() => setAuthMode('signup')} className="text-indigo-600 hover:underline">Sign Up</button>
          </p>
        )}
        {authMode === 'signup' && (
          <p className="text-center text-sm mt-4">
            Already have an account?{' '}
            <button type="button" onClick={() => setAuthMode('login')} className="text-indigo-600 hover:underline">Login</button>
          </p>
        )}
        {authMode !== 'forgotPassword' && (
          <p className="text-center text-sm mt-2">
            <button type="button" onClick={() => setAuthMode('forgotPassword')} className="text-gray-500 hover:underline dark:text-gray-400">Forgot Password?</button>
          </p>
        )}
        {authMode === 'forgotPassword' && (
          <p className="text-center text-sm mt-2">
            Remembered your password?{' '}
            <button type="button" onClick={() => setAuthMode('login')} className="text-indigo-600 hover:underline">Login</button>
          </p>
        )}
      </form>
    </Dialog>

    {/* Profile Edit Dialog */}
    <Dialog
      isOpen={isProfileEditOpen}
      onClose={() => setIsProfileEditOpen(false)}
      title="Edit Profile"
    >
      <form onSubmit={handleUpdateProfile} className="space-y-4">
        <div>
          <label htmlFor="newUsername" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Username</label>
          <input
            type="text"
            id="newUsername"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            className="mt-1 block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-100 p-2.5 text-base"
            required
          />
        </div>
        {profileError && (
          <p className="text-red-500 text-sm">{profileError}</p>
        )}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => setIsProfileEditOpen(false)}
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition-colors duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Save Changes
          </button>
        </div>
      </form>
    </Dialog>

    {/* Confirmation Dialog */}
    <ConfirmationDialog
      isOpen={isConfirmOpen}
      onClose={() => setIsConfirmOpen(false)}
      onConfirm={onConfirmAction}
      message={confirmMessage}
    />
  </div>
);
};

export default App;
