import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sofa, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Password validation state
  const [pwdError, setPwdError] = useState('');
  const [isPwdTouched, setIsPwdTouched] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const WEAK_PASSWORDS = ['123', '123456', 'password', 'qwerty', 'azerty', 'admin'];

  const validatePassword = (value) => {
    if (WEAK_PASSWORDS.includes(value.toLowerCase())) {
      return "Mot de passe trop faible ! Veuillez ne pas utiliser de mots de passe courants.";
    }
    if (value.length < 6 || value.length > 8) {
      return "Mot de passe trop faible ! Veuillez choisir un mot de passe de 6 à 8 caractères, contenant des lettres et des chiffres.";
    }
    const hasLetter = /[a-zA-Z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    if (!hasLetter || !hasNumber) {
      return "Mot de passe trop faible ! Veuillez choisir un mot de passe de 6 à 8 caractères, contenant des lettres et des chiffres.";
    }
    return '';
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setIsPwdTouched(true);
    setPwdError(validatePassword(val));
  }; // END NEW VALIDATION LOGIC

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Trigger validation on form submission
    const validationError = validatePassword(password);
    if (validationError) {
      setPwdError(validationError);
      setIsPwdTouched(true);
      return; // Do not allow the form to submit
    }

    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo"><Sofa size={32} /></div>
          <h1>Le Canapé</h1>
          <p>Connectez-vous à votre compte ERP</p>
        </div>
        {error && (
          <div className="login-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom d'utilisateur</label>
            <input
              type="text"
              className="form-control"
              placeholder="Entrez votre nom d'utilisateur"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              className="form-control"
              placeholder="Entrez votre mot de passe"
              value={password}
              onChange={handlePasswordChange}
              style={{
                borderColor: !isPwdTouched ? '' : pwdError ? '#ff4d4f' : '#52c41a',
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
            />
            {isPwdTouched && pwdError && (
              <p style={{ color: '#ff4d4f', fontSize: '13px', marginTop: '5px' }}>
                {pwdError}
              </p>
            )}
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
          >
            {loading ? 'Connexion en cours...' : 'Se Connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
