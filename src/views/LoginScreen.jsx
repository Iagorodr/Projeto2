import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { styles } from "../styles/styles.js";
import { COLORS } from "../styles/colors.js";
import { TopBar, LangSwitcher } from "./shared/Layout.jsx";

function LoginScreen({ lang, setLang, onEnterManagement, onEnterEmployee, company, staff }) {
  const [mode, setMode] = useState("gerencia"); // 'gerencia' | 'funcionario'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div style={styles.loginShell}>
      <div style={styles.loginLeft} />
      <div style={styles.loginRight}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <LangSwitcher lang={lang} setLang={setLang} />
        </div>
        <div style={styles.loginFields}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{company.name}</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <button
              style={{ ...styles.avTypeToggle, ...(mode === "gerencia" ? styles.avTypeActiveNotice : {}) }}
              onClick={() => setMode("gerencia")}
            >
              Sou gerência
            </button>
            <button
              style={{ ...styles.avTypeToggle, ...(mode === "funcionario" ? styles.avTypeActiveNotice : {}) }}
              onClick={() => setMode("funcionario")}
            >
              Sou funcionário
            </button>
          </div>

          {mode === "gerencia" ? (
            <>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="digite seu email" style={styles.loginInput} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="digite sua senha" style={styles.loginInput} />
              <div style={styles.forgotRow}>
                <button style={styles.forgotLink}>Esqueci minha senha</button>
              </div>
              <button style={styles.enterButton} onClick={onEnterManagement}>Entrar</button>
            </>
          ) : (
            <>
              <div style={{ ...styles.defSettingHint, marginBottom: 4 }}>Escolha quem está a entrar (demonstração):</div>
              {staff.map((s) => (
                <button key={s.id} style={{ ...styles.cancelButton, textAlign: "left" }} onClick={() => onEnterEmployee(s.id)}>
                  {s.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
