from string import Template

from mailing.sender import Message


def render(subject_tpl: str, body_tpl: str, recipient: dict) -> Message:
    context = {
        "name": recipient.get("name", "there"),
        "plan": recipient.get("plan", "free"),
    }
    return Message(
        to=recipient["email"],
        subject=Template(subject_tpl).safe_substitute(context),
        body=Template(body_tpl).safe_substitute(context),
    )
