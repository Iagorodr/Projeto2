import { useState } from "react";
import {
  ChevronDown, ChevronRight, LayoutDashboard, Users, CalendarDays, Clock, Bell, UsersRound, Settings,
  Search, X, Pencil, Mail, Phone, Briefcase, Calendar, KeyRound, MapPin, Euro, RotateCcw, Check,
  Plus, Store, Building2, Home as HouseIcon, Factory, MessageSquare, ThumbsUp, PackageX, Info, Archive,
} from "lucide-react";
import { COLORS } from "../../styles/colors.js";

function ChevronLeftIcon() { return <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />; }

function ChevronRightIcon() { return <ChevronRight size={16} />; }

function ChevronLeftMini() { return <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />; }

function ChevronRightMini() { return <ChevronRight size={16} />; }

function Minus2() { return <span style={{ width: 18, height: 2, background: COLORS.text, display: "block" }} />; }

export { ChevronLeftIcon, ChevronRightIcon, ChevronLeftMini, ChevronRightMini, Minus2 };
