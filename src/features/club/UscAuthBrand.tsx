import React from "react";
import { Link } from "react-router-dom";
import { ClubLogo } from "../../components/branding/ClubLogo";
import { USC_APP_PATH, USC_LOGO } from "./uscClub";
import "./uscAuth.css";
export function UscAuthBrand() {
  return (
    <div className="usc-auth-brand">
      <Link to={USC_APP_PATH} aria-label="Zur USC-Vereinsapp">
        <ClubLogo
          src={USC_LOGO}
          removeDarkBackground
          alt="USC Kaschütz Rohrbach"
        />
      </Link>
      <p>#GEMEINSAMSTARK</p>
    </div>
  );
}
export function UscAuthFooter() {
  return (
    <p className="usc-auth-footer">USC Rohrbach · powered by SpielzeitApp</p>
  );
}
