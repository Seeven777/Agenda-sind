import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from '../lib/firebase';
import { User, Role } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandler';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      if (fUser) {
        try {
          const userRef = doc(db, 'users', fUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUser({ id: userSnap.id, ...userSnap.data() } as User);
          } else {
            // Create new user profile
            const newUser: Omit<User, 'id'> = {
              uid: fUser.uid,
              name: fUser.displayName || 'Usuário',
              email: fUser.email || '',
              role: 'administrativo', // Default role
              createdAt: new Date().toISOString(),
            };
            
            try {
              await setDoc(userRef, newUser);
              setUser({ id: fUser.uid, ...newUser } as User);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `users/${fUser.uid}`);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${fUser.uid}`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    await loginWithGoogle();
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login: handleLogin, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
