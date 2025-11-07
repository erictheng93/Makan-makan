-- ============================================================================
-- Migration: 13_ai_insights.sql
-- Layer: 5 (Analytics Layer)
-- Description: AI-powered insights, predictions, and recommendations
-- Dependencies: 12_business_analytics.sql, multiple other layers
-- ============================================================================

-- ============================================================================
-- TABLE: ai_configurations
-- Description: AI model configurations and settings
-- Features:
--   - Multiple AI providers (OpenAI, Anthropic, Google, etc.)
--   - Model selection and parameters
--   - Usage tracking
--   - Cost monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_configurations (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Configuration Info
    config_name TEXT NOT NULL,
    description TEXT,
    config_type TEXT NOT NULL,                 -- 'insight', 'prediction', 'recommendation', 'analysis'

    -- AI Provider
    provider TEXT NOT NULL,                    -- 'openai', 'anthropic', 'google', 'custom'
    model TEXT NOT NULL,                       -- 'gpt-4', 'claude-3-opus', etc.
    api_endpoint TEXT,

    -- Model Parameters
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2000,
    top_p REAL DEFAULT 1.0,
    frequency_penalty REAL DEFAULT 0,
    presence_penalty REAL DEFAULT 0,
    model_params TEXT DEFAULT '{}',            -- JSON: additional parameters

    -- Prompts
    system_prompt TEXT,
    prompt_template TEXT,
    context_instructions TEXT,

    -- Usage Limits
    daily_request_limit INTEGER,
    monthly_request_limit INTEGER,
    cost_per_request REAL,
    monthly_budget REAL,

    -- Current Usage
    requests_today INTEGER DEFAULT 0,
    requests_this_month INTEGER DEFAULT 0,
    cost_today REAL DEFAULT 0,
    cost_this_month REAL DEFAULT 0,
    last_request_at INTEGER,

    -- Performance
    average_response_time INTEGER,             -- Milliseconds
    success_rate REAL DEFAULT 0,               -- Percentage
    error_count INTEGER DEFAULT 0,

    -- Status
    is_active INTEGER DEFAULT 1,
    is_enabled INTEGER DEFAULT 1,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (config_type IN ('insight', 'prediction', 'recommendation', 'analysis', 'optimization', 'forecasting')),
    CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'huggingface', 'custom')),
    CHECK (temperature >= 0 AND temperature <= 2),
    CHECK (top_p >= 0 AND top_p <= 1),
    CHECK (is_active IN (0, 1)),
    CHECK (is_enabled IN (0, 1)),
    UNIQUE(restaurant_id, config_name)
);

-- Indexes for ai_configurations
CREATE INDEX IF NOT EXISTS idx_ai_config_restaurant ON ai_configurations(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_config_type ON ai_configurations(config_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_config_active ON ai_configurations(is_active) WHERE is_active = 1 AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: ai_insights_cache
-- Description: Cached AI-generated insights
-- Features:
--   - Insight caching for performance
--   - Expiration management
--   - Version tracking
--   - Confidence scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_insights_cache (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Configuration
    ai_config_id TEXT NOT NULL,

    -- Insight Details
    insight_type TEXT NOT NULL,                -- 'sales_forecast', 'menu_optimization', etc.
    insight_category TEXT NOT NULL,            -- 'operational', 'financial', 'customer', 'menu'
    insight_key TEXT NOT NULL,                 -- Unique identifier for caching

    -- Content
    insight_title TEXT NOT NULL,
    insight_summary TEXT NOT NULL,
    insight_details TEXT,                      -- Full analysis
    recommendations TEXT DEFAULT '[]',         -- JSON: actionable recommendations
    data_points TEXT DEFAULT '{}',             -- JSON: supporting data

    -- Metrics
    confidence_score REAL,                     -- 0-1
    impact_score INTEGER,                      -- 1-10
    priority TEXT DEFAULT 'medium',            -- 'low', 'medium', 'high', 'critical'
    actionability_score REAL,                  -- 0-1

    -- Time Context
    analysis_period_start INTEGER,
    analysis_period_end INTEGER,
    forecast_period_start INTEGER,             -- For predictions
    forecast_period_end INTEGER,

    -- Generation Info
    model_used TEXT,
    provider TEXT,
    tokens_used INTEGER,
    generation_cost REAL,
    generation_time INTEGER,                   -- Milliseconds

    -- Cache Management
    cache_key TEXT UNIQUE,                     -- MD5 of parameters
    expires_at INTEGER,
    is_expired INTEGER DEFAULT 0,
    cache_hit_count INTEGER DEFAULT 0,
    last_accessed_at INTEGER,

    -- Validation
    is_validated INTEGER DEFAULT 0,
    validated_by_user_id TEXT,
    validated_at INTEGER,
    accuracy_feedback REAL,                    -- 0-1, from user feedback

    -- Status
    status TEXT NOT NULL DEFAULT 'active',

    -- Metadata
    metadata TEXT DEFAULT '{}',
    tags TEXT DEFAULT '[]',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (ai_config_id) REFERENCES ai_configurations(id) ON DELETE CASCADE,
    FOREIGN KEY (validated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (insight_category IN ('operational', 'financial', 'customer', 'menu', 'staffing', 'inventory', 'marketing')),
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CHECK (status IN ('active', 'expired', 'invalidated', 'archived')),
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    CHECK (impact_score IS NULL OR (impact_score >= 1 AND impact_score <= 10)),
    CHECK (is_expired IN (0, 1)),
    CHECK (is_validated IN (0, 1))
);

-- Indexes for ai_insights_cache
CREATE INDEX IF NOT EXISTS idx_insights_restaurant ON ai_insights_cache(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights_cache(insight_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_insights_category ON ai_insights_cache(insight_category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_insights_priority ON ai_insights_cache(priority) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_insights_cache_key ON ai_insights_cache(cache_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_insights_expires ON ai_insights_cache(expires_at) WHERE is_expired = 0 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_insights_active ON ai_insights_cache(restaurant_id, status) WHERE status = 'active' AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: prediction_models
-- Description: AI prediction models and their results
-- Features:
--   - Demand forecasting
--   - Revenue predictions
--   - Customer churn prediction
--   - Inventory optimization
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_models (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Model Info
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,                  -- 'demand_forecast', 'revenue_predict', 'churn_predict'
    model_version TEXT DEFAULT '1.0',
    description TEXT,

    -- Configuration
    ai_config_id TEXT,
    algorithm TEXT,                            -- 'linear_regression', 'random_forest', 'neural_network'
    features_used TEXT DEFAULT '[]',           -- JSON: list of feature names
    training_data_period_days INTEGER,

    -- Training Info
    last_trained_at INTEGER,
    training_samples_count INTEGER,
    training_accuracy REAL,
    validation_accuracy REAL,
    test_accuracy REAL,

    -- Current Performance
    predictions_made INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    current_accuracy REAL,
    mae REAL,                                  -- Mean Absolute Error
    rmse REAL,                                 -- Root Mean Square Error
    r_squared REAL,                            -- R-squared score

    -- Prediction Results (Latest)
    latest_prediction_date INTEGER,
    latest_prediction_value REAL,
    latest_prediction_confidence REAL,
    latest_actual_value REAL,
    latest_error_rate REAL,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',     -- 'training', 'active', 'deprecated'
    is_production INTEGER DEFAULT 0,
    requires_retraining INTEGER DEFAULT 0,

    -- Usage
    total_api_calls INTEGER DEFAULT 0,
    last_api_call_at INTEGER,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    hyperparameters TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (ai_config_id) REFERENCES ai_configurations(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (model_type IN ('demand_forecast', 'revenue_predict', 'churn_predict', 'inventory_optimize', 'price_optimize', 'staffing_optimize')),
    CHECK (status IN ('training', 'active', 'deprecated', 'failed')),
    CHECK (is_production IN (0, 1)),
    CHECK (requires_retraining IN (0, 1)),
    UNIQUE(restaurant_id, model_name, model_version)
);

-- Indexes for prediction_models
CREATE INDEX IF NOT EXISTS idx_models_restaurant ON prediction_models(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_models_type ON prediction_models(model_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_models_status ON prediction_models(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_models_production ON prediction_models(is_production) WHERE is_production = 1 AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: recommendation_history
-- Description: AI recommendations and their outcomes
-- Features:
--   - Recommendation tracking
--   - Implementation status
--   - Outcome measurement
--   - ROI calculation
-- ============================================================================

CREATE TABLE IF NOT EXISTS recommendation_history (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Source
    insight_id TEXT,
    ai_config_id TEXT,

    -- Recommendation Details
    recommendation_type TEXT NOT NULL,         -- 'menu_change', 'pricing', 'staffing', 'marketing'
    recommendation_title TEXT NOT NULL,
    recommendation_description TEXT NOT NULL,
    recommended_action TEXT NOT NULL,

    -- Context
    situation_analysis TEXT,
    expected_impact TEXT,
    expected_roi REAL,                         -- Expected return on investment
    confidence_level REAL,                     -- 0-1

    -- Priority
    priority TEXT DEFAULT 'medium',
    urgency TEXT DEFAULT 'normal',             -- 'low', 'normal', 'high', 'immediate'
    effort_required TEXT DEFAULT 'medium',     -- 'low', 'medium', 'high'

    -- Implementation
    status TEXT NOT NULL DEFAULT 'pending',
    implemented_at INTEGER,
    implemented_by_user_id TEXT,
    implementation_notes TEXT,

    -- Tracking
    measurement_start_date INTEGER,
    measurement_end_date INTEGER,
    metrics_to_track TEXT DEFAULT '[]',        -- JSON: list of KPIs

    -- Outcomes
    actual_impact TEXT,
    actual_roi REAL,
    outcome_status TEXT,                       -- 'positive', 'negative', 'neutral', 'mixed'
    was_successful INTEGER DEFAULT 0,

    -- Feedback
    user_feedback TEXT,
    user_rating INTEGER,                       -- 1-5
    lessons_learned TEXT,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    tags TEXT DEFAULT '[]',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (insight_id) REFERENCES ai_insights_cache(id) ON DELETE SET NULL,
    FOREIGN KEY (ai_config_id) REFERENCES ai_configurations(id) ON DELETE SET NULL,
    FOREIGN KEY (implemented_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (recommendation_type IN ('menu_change', 'pricing', 'staffing', 'marketing', 'inventory', 'operations', 'customer_service')),
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CHECK (urgency IN ('low', 'normal', 'high', 'immediate')),
    CHECK (effort_required IN ('low', 'medium', 'high')),
    CHECK (status IN ('pending', 'reviewing', 'approved', 'implementing', 'implemented', 'rejected', 'cancelled')),
    CHECK (outcome_status IS NULL OR outcome_status IN ('positive', 'negative', 'neutral', 'mixed')),
    CHECK (was_successful IN (0, 1)),
    CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5))
);

-- Indexes for recommendation_history
CREATE INDEX IF NOT EXISTS idx_recommendations_restaurant ON recommendation_history(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendation_history(recommendation_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendation_history(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendation_history(priority, urgency) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_pending ON recommendation_history(restaurant_id, status) WHERE status IN ('pending', 'reviewing') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_insight ON recommendation_history(insight_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- VIEWS: AI insights and recommendations dashboard
-- ============================================================================

-- View: Active insights
CREATE VIEW IF NOT EXISTS v_active_insights AS
SELECT
    aic.id,
    aic.restaurant_id,
    aic.insight_type,
    aic.insight_category,
    aic.insight_title,
    aic.insight_summary,
    aic.confidence_score,
    aic.impact_score,
    aic.priority,
    aic.created_at,
    aic.expires_at
FROM ai_insights_cache aic
WHERE aic.deleted_at IS NULL
    AND aic.status = 'active'
    AND aic.is_expired = 0
ORDER BY aic.priority DESC, aic.impact_score DESC;

-- View: Pending recommendations
CREATE VIEW IF NOT EXISTS v_pending_recommendations AS
SELECT
    rh.id,
    rh.restaurant_id,
    rh.recommendation_type,
    rh.recommendation_title,
    rh.recommended_action,
    rh.priority,
    rh.urgency,
    rh.expected_roi,
    rh.confidence_level,
    rh.created_at
FROM recommendation_history rh
WHERE rh.deleted_at IS NULL
    AND rh.status IN ('pending', 'reviewing')
ORDER BY
    CASE rh.urgency
        WHEN 'immediate' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
    END,
    rh.expected_roi DESC;

-- View: Model performance
CREATE VIEW IF NOT EXISTS v_model_performance AS
SELECT
    pm.id,
    pm.restaurant_id,
    pm.model_name,
    pm.model_type,
    pm.current_accuracy,
    pm.predictions_made,
    pm.correct_predictions,
    pm.last_trained_at,
    pm.is_production
FROM prediction_models pm
WHERE pm.deleted_at IS NULL
    AND pm.status = 'active'
ORDER BY pm.current_accuracy DESC;

-- View: AI usage summary
CREATE VIEW IF NOT EXISTS v_ai_usage_summary AS
SELECT
    aic.restaurant_id,
    aic.provider,
    COUNT(*) as active_configs,
    SUM(aic.requests_today) as requests_today,
    SUM(aic.requests_this_month) as requests_this_month,
    SUM(aic.cost_today) as cost_today,
    SUM(aic.cost_this_month) as cost_this_month,
    AVG(aic.success_rate) as avg_success_rate
FROM ai_configurations aic
WHERE aic.deleted_at IS NULL
    AND aic.is_active = 1
GROUP BY aic.restaurant_id, aic.provider;

-- ============================================================================
-- TRIGGERS: Auto-update and cache management
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_ai_config_updated_at
AFTER UPDATE ON ai_configurations
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ai_configurations SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_insights_updated_at
AFTER UPDATE ON ai_insights_cache
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE ai_insights_cache SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_models_updated_at
AFTER UPDATE ON prediction_models
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE prediction_models SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_recommendations_updated_at
AFTER UPDATE ON recommendation_history
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE recommendation_history SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

-- Trigger: Mark expired insights
CREATE TRIGGER IF NOT EXISTS trg_mark_expired_insights
AFTER UPDATE ON ai_insights_cache
FOR EACH ROW
WHEN NEW.expires_at < (unixepoch('now') * 1000) AND NEW.is_expired = 0
BEGIN
    UPDATE ai_insights_cache
    SET
        is_expired = 1,
        status = 'expired'
    WHERE id = NEW.id;
END;

-- Trigger: Update config usage on insight generation
CREATE TRIGGER IF NOT EXISTS trg_update_config_usage
AFTER INSERT ON ai_insights_cache
FOR EACH ROW
BEGIN
    UPDATE ai_configurations
    SET
        requests_today = requests_today + 1,
        requests_this_month = requests_this_month + 1,
        cost_today = cost_today + COALESCE(NEW.generation_cost, 0),
        cost_this_month = cost_this_month + COALESCE(NEW.generation_cost, 0),
        last_request_at = NEW.created_at
    WHERE id = NEW.ai_config_id;
END;

-- ============================================================================
-- END OF MIGRATION: 13_ai_insights.sql
-- ============================================================================
-- Summary:
--   - Tables: 4 (ai_configurations, ai_insights_cache, prediction_models,
--               recommendation_history)
--   - Indexes: 20 total
--   - Views: 4 (active_insights, pending_recommendations, model_performance,
--              usage_summary)
--   - Triggers: 6 (auto-update, cache management, usage tracking)
--   - Lines: ~650
--
-- Features:
--   ✅ Multi-provider AI support
--   ✅ Insight caching system
--   ✅ Prediction models
--   ✅ Recommendation tracking
--   ✅ ROI measurement
--   ✅ Cost monitoring
--   ✅ Performance metrics
--   ✅ Confidence scoring
--   ✅ Expiration management
--   ✅ Implementation tracking
--   ✅ Outcome measurement
--   ✅ User feedback collection
-- ============================================================================
