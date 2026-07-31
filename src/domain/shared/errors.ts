export class DomainError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class EmptyName extends DomainError {}
export class MissingFieldReference extends DomainError {}
export class InvalidHectares extends DomainError {}
export class InvalidCoordinates extends DomainError {}
export class InvalidVisitInterval extends DomainError {}
export class IncompleteFollowUp extends DomainError {}
export class FieldNotFound extends DomainError {}
export class FutureVisitDate extends DomainError {}
export class DuplicateVisitForDay extends DomainError {}
export class ZoneNotFound extends DomainError {}
export class ClientNotFound extends DomainError {}
export class VisitNotFound extends DomainError {}
export class VisitAlreadyCancelled extends DomainError {}
