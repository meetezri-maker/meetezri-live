import type { AvatarPayload } from "../../types/avatarPayload";
import { AvatarController } from "../avatar/AvatarController";
export class TimelineEngine { controller: AvatarController; constructor(payload: AvatarPayload) { this.controller = new AvatarController(payload); } evaluate(audioTime: number, deltaSeconds: number) { return this.controller.evaluate(audioTime, deltaSeconds); } }
