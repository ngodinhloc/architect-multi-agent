export enum ChatStatus {
  isActive = 'isActive',
  isStopped = 'isStopped',
}

export enum AgentStatus {
  isThinking = 'isThinking',
  hasReplied = 'hasReplied',
}

export enum ChatActor {
  user = 'User',
  agent = 'Agent',
}

export interface FeatureInterface {
  feature: string;
}

export interface ComponentInterface {
  tech: string;
  features: FeatureInterface[];
}

export interface SolutionInterface {
  architecture: string;
  components: ComponentInterface[];
}

export interface RequirementInterface {
  requirement: string;
}

export interface AcceptanceCriterionInterface {
  criterion: string;
}

export interface EpicInterface {
  id: string;
  name: string;
  requirements: RequirementInterface[];
  solution: SolutionInterface;
}

export interface TicketInterface {
  id: string;
  epicId: string;
  name: string;
  requirements: RequirementInterface[];
  acceptance_criteria: AcceptanceCriterionInterface[];
}

export interface ReplyInterface {
  epic: EpicInterface;
  tickets: TicketInterface[];
}

export interface FinalReplyInterface {
  epicId: string;
  ticketIds: string[];
}

export interface MessageInterface {
  actor: ChatActor;
  timestamp: Date;
  content: string | ReplyInterface | FinalReplyInterface;
  agentStatus?: AgentStatus | null;
}

export interface ChatInterface {
  id: string;
  title: string;
  timestamp?: Date;
  messages: MessageInterface[];
  status: ChatStatus;
  agentStatus?: AgentStatus;
  created_at?: Date;
  modified_at?: Date;
}

export interface ChatHistoryInterface {
  id: string;
  title?: string;
  createdAt: Date;
}

export interface ChatCreatedResponse {
  id: string;
}

export interface ChatContinueResponse {
  accepted: true;
}

export interface ChatStopResponse {
  stopped: true;
}