# Training data — labeler terms (checkpoint 1)

This file records only the terms decision. No eval file, no training
file, and no labels are produced in this commit.

## How labels would be generated in this environment

Label generation in *this* session is the **xAI consumer product**
(Grok in chat), not the xAI API. There is no API key and no
`api.x.ai` client in this environment. Hundreds of examples cannot
honestly be described as an API labeling run unless someone later
calls the API on a machine that has credentials.

The consumer Terms of Service and the Enterprise / API Terms of
Service are different documents. They are not interchangeable.

## xAI API / Enterprise — cannot be the labeler

If labeling is done through the xAI API (or Grok Business), the
governing document is the Enterprise Terms, not the consumer Terms.

Source: [Terms of Service — Enterprise](https://x.ai/legal/terms-of-service-enterprise/),
last updated **14 August 2026**, covering the SpaceXAI/xAI API and
related business services including Grok.

Quoted restriction:

> Customer will not, and will not permit any third party to: (i) use
> any Output to train any foundation models, large language models,
> or other artificial intelligence systems except as may be expressly
> permitted in an Order Form;

This project has no Order Form that permits that use. Moka-v1 is an
artificial intelligence system. API Output therefore **must not** be
used as eval or training labels.

The same document assigns ownership of Output to the customer. Ownership
is not a license to train. The training ban sits in the same Output
section as the ownership grant.

Enterprise FAQ ([faq-enterprise](https://x.ai/legal/faq-enterprise/)):

> You are prohibited from directly using or having someone else use
> the SpaceXAI API to lease our service or to develop or run any
> service similar to or competitive with any SpaceXAI service.

That is a second, broader limit on API use for a competing service.
It is not the clause this decision turns on; the Output-training ban
is sufficient by itself.

## Consumer Grok (this chat) — not a substitute API pipeline

Source: [Terms of Service — Consumer](https://x.ai/legal/terms-of-service/),
last updated **11 September 2026**.

The consumer Terms state that Enterprise Terms govern developers and
businesses, including APIs:

> Our Enterprise Terms of Service govern the use of our Services for
> developers and businesses, including SpaceXAI APIs and PromptIDE.

On ownership, the consumer Terms say:

> To the extent permitted by applicable law, and as between you and
> SpaceXAI, you retain your ownership rights to the User Content.

They do **not** contain the Enterprise sentence that forbids using
Output to train the customer’s own models. They also do not grant
permission to treat a consumer chat as a bulk labeling API.

Using this chat to emit hundreds of labeled rows and then calling
that “API labeling under consumer Terms” would be the same category
of error as the last status report: the wrong contract applied to
the work that was actually planned.

## Decision

1. **Do not call the xAI API to generate eval or training labels**
   for Moka-v1. The Enterprise Terms forbid using that Output to
   train an AI system, and this project has no Order Form exception.
2. **Do not treat consumer-chat Grok traces as a licensed bulk
   labeler** for a training set. That path is the consumer product,
   not the API, and it does not become the API by volume.
3. Later checkpoints must label by a route these terms allow:
   project-authored fixtures with construction-rule gold (the answer
   is determined by facts written into the state), and/or a third-party
   model whose license expressly allows using outputs to train another
   encoder, with that license named before any such labels are written.

Nothing in this file is a dataset. Checkpoint 2 starts only after
this decision is on `main` and reviewed.
