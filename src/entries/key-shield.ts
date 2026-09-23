// Runs at document_start, before any page script, so its window capture
// listener is the first one a keystroke meets. See lib/key-shield.
import { installKeyShield } from "../lib/key-shield";

installKeyShield();
