export type ChatStatus = 'isActive' | 'isStopped';
export type AgentStatus = 'isThinking' | 'hasReplied';
export type ChatActor = 'User' | 'Agent';

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
  timestamp: string;
  content: string | ReplyInterface | FinalReplyInterface;
  agentStatus?: AgentStatus | null;
}

export interface ChatInterface {
  id: string;
  title?: string | null;
  messages: MessageInterface[];
  status: ChatStatus;
  agentStatus?: AgentStatus;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
}
