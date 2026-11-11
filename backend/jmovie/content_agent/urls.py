from django.urls import path

from .views import (
    AgentDraftActionView,
    AgentDraftBulkActionView,
    AgentDraftListView,
    AgentRunListView,
    AgentRunView,
    AgentSettingsView,
)

urlpatterns = [
    path("settings/", AgentSettingsView.as_view(), name="agent-settings"),
    path("run/", AgentRunView.as_view(), name="agent-run"),
    path("runs/", AgentRunListView.as_view(), name="agent-runs"),
    path("drafts/", AgentDraftListView.as_view(), name="agent-drafts"),
    path("drafts/bulk/", AgentDraftBulkActionView.as_view(), name="agent-drafts-bulk"),
    path(
        "drafts/<int:pk>/<str:action>/",
        AgentDraftActionView.as_view(),
        name="agent-draft-action",
    ),
]
