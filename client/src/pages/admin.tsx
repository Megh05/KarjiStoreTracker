import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, Bot, Database, Upload, RefreshCw, ExternalLink, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AiConfig {
  id: number;
  provider: 'azure' | 'ollama';
  config: any;
  customInstructions?: string;
  isActive: boolean;
}

interface OllamaModel {
  name: string;
  size: string;
}

interface KnowledgeBase {
  id: number;
  title: string;
  content: string;
  type: string;
  sourceUrl?: string;
  isActive: boolean;
  createdOnUtc: string;
}

interface MerchantFeed {
  id: number;
  name: string;
  feedUrl: string;
  isActive: boolean;
  lastSyncedAt?: string;
  syncInterval: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<'azure' | 'ollama'>('azure');
  const [customInstructions, setCustomInstructions] = useState('');

  // AI Configuration Form States
  const [azureConfig, setAzureConfig] = useState({
    endpoint: '',
    apiKey: '',
    deploymentName: '',
    apiVersion: '2024-02-01'
  });

  const [ollamaConfig, setOllamaConfig] = useState({
    endpoint: 'http://localhost:11434',
    model: ''
  });

  // Knowledge Base Form States
  const [newKnowledge, setNewKnowledge] = useState({
    title: '',
    content: '',
    type: 'faq',
    sourceUrl: ''
  });

  // Merchant Feed Form States
  const [newFeed, setNewFeed] = useState({
    name: '',
    feedUrl: '',
    syncInterval: 10800 // 3 hours
  });

  // Query for current AI configuration
  const { data: aiConfig } = useQuery({
    queryKey: ['/api/admin/ai-config'],
    queryFn: () => apiRequest('/api/admin/ai-config')
  });

  // Query for Ollama models
  const { data: ollamaModels, refetch: refetchModels } = useQuery({
    queryKey: ['/api/admin/ollama-models'],
    queryFn: () => apiRequest('/api/admin/ollama-models'),
    enabled: selectedProvider === 'ollama'
  });

  // Query for knowledge base
  const { data: knowledgeBase } = useQuery({
    queryKey: ['/api/admin/knowledge-base'],
    queryFn: () => apiRequest('/api/admin/knowledge-base')
  });

  // Query for merchant feeds
  const { data: merchantFeeds } = useQuery({
    queryKey: ['/api/admin/merchant-feeds'],
    queryFn: () => apiRequest('/api/admin/merchant-feeds')
  });

  // Mutations
  const saveAiConfigMutation = useMutation({
    mutationFn: (config: any) => apiRequest('/api/admin/ai-config', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
    onSuccess: () => {
      toast({ title: "AI Configuration saved successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-config'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to save AI configuration",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: (config: any) => apiRequest('/api/admin/test-connection', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
    onSuccess: () => {
      toast({ title: "Connection test successful!" });
    },
    onError: (error: any) => {
      toast({
        title: "Connection test failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const addKnowledgeMutation = useMutation({
    mutationFn: (knowledge: any) => apiRequest('/api/admin/knowledge-base', {
      method: 'POST',
      body: JSON.stringify(knowledge)
    }),
    onSuccess: () => {
      toast({ title: "Knowledge added successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/knowledge-base'] });
      setNewKnowledge({ title: '', content: '', type: 'faq', sourceUrl: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add knowledge",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const addMerchantFeedMutation = useMutation({
    mutationFn: (feed: any) => apiRequest('/api/admin/merchant-feeds', {
      method: 'POST',
      body: JSON.stringify(feed)
    }),
    onSuccess: () => {
      toast({ title: "Merchant feed added successfully!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/merchant-feeds'] });
      setNewFeed({ name: '', feedUrl: '', syncInterval: 10800 });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add merchant feed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const syncFeedsMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/sync-feeds', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: "Merchant feeds sync started!" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/merchant-feeds'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to sync feeds",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Load current config
  useEffect(() => {
    if (aiConfig) {
      setSelectedProvider(aiConfig.provider);
      setCustomInstructions(aiConfig.customInstructions || '');
      
      if (aiConfig.provider === 'azure') {
        setAzureConfig(aiConfig.config);
      } else if (aiConfig.provider === 'ollama') {
        setOllamaConfig(aiConfig.config);
      }
    }
  }, [aiConfig]);

  const handleSaveAiConfig = () => {
    const config = {
      provider: selectedProvider,
      config: selectedProvider === 'azure' ? azureConfig : ollamaConfig,
      customInstructions
    };
    saveAiConfigMutation.mutate(config);
  };

  const handleTestConnection = () => {
    const config = {
      provider: selectedProvider,
      config: selectedProvider === 'azure' ? azureConfig : ollamaConfig
    };
    testConnectionMutation.mutate(config);
  };

  const handleRefreshModels = () => {
    refetchModels();
    toast({ title: "Refreshing available models..." });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Configure your AI chatbot and manage knowledge base</p>
        </div>

        <Tabs defaultValue="ai-config" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai-config" className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Configuration
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Knowledge Base
            </TabsTrigger>
            <TabsTrigger value="merchant" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Merchant Feeds
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Content
            </TabsTrigger>
          </TabsList>

          {/* AI Configuration Tab */}
          <TabsContent value="ai-config">
            <Card>
              <CardHeader>
                <CardTitle>AI Provider Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="provider">AI Provider</Label>
                  <Select value={selectedProvider} onValueChange={(value: 'azure' | 'ollama') => setSelectedProvider(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="azure">Azure OpenAI</SelectItem>
                      <SelectItem value="ollama">Ollama (Local)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedProvider === 'azure' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="endpoint">Azure OpenAI Endpoint</Label>
                      <Input
                        id="endpoint"
                        placeholder="https://your-resource.openai.azure.com"
                        value={azureConfig.endpoint}
                        onChange={(e) => setAzureConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="Your Azure OpenAI API Key"
                        value={azureConfig.apiKey}
                        onChange={(e) => setAzureConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="deploymentName">Deployment Name</Label>
                      <Input
                        id="deploymentName"
                        placeholder="gpt-4o"
                        value={azureConfig.deploymentName}
                        onChange={(e) => setAzureConfig(prev => ({ ...prev, deploymentName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="apiVersion">API Version</Label>
                      <Input
                        id="apiVersion"
                        placeholder="2024-02-01"
                        value={azureConfig.apiVersion}
                        onChange={(e) => setAzureConfig(prev => ({ ...prev, apiVersion: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

                {selectedProvider === 'ollama' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ollamaEndpoint">Ollama Endpoint</Label>
                      <Input
                        id="ollamaEndpoint"
                        placeholder="http://localhost:11434"
                        value={ollamaConfig.endpoint}
                        onChange={(e) => setOllamaConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="model">Model</Label>
                      <div className="flex gap-2">
                        <Select value={ollamaConfig.model} onValueChange={(value) => setOllamaConfig(prev => ({ ...prev, model: value }))}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select Model" />
                          </SelectTrigger>
                          <SelectContent>
                            {ollamaModels?.map((model: OllamaModel) => (
                              <SelectItem key={model.name} value={model.name}>
                                {model.name} ({model.size})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="outline" 
                          onClick={handleRefreshModels}
                          disabled={refetchModels.isFetching}
                        >
                          <RefreshCw className={`w-4 h-4 ${refetchModels.isFetching ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="instructions">Custom Instructions</Label>
                  <Textarea
                    id="instructions"
                    placeholder="Additional instructions for the AI model..."
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleTestConnection}
                    variant="outline"
                    disabled={testConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                  <Button 
                    onClick={handleSaveAiConfig}
                    disabled={saveAiConfigMutation.isPending}
                  >
                    {saveAiConfigMutation.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add Knowledge</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="knowledgeTitle">Title</Label>
                      <Input
                        id="knowledgeTitle"
                        placeholder="Knowledge title..."
                        value={newKnowledge.title}
                        onChange={(e) => setNewKnowledge(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="knowledgeType">Type</Label>
                      <Select value={newKnowledge.type} onValueChange={(value) => setNewKnowledge(prev => ({ ...prev, type: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="faq">FAQ</SelectItem>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="sourceUrl">Source URL (optional)</Label>
                    <Input
                      id="sourceUrl"
                      placeholder="https://example.com"
                      value={newKnowledge.sourceUrl}
                      onChange={(e) => setNewKnowledge(prev => ({ ...prev, sourceUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="knowledgeContent">Content</Label>
                    <Textarea
                      id="knowledgeContent"
                      placeholder="Knowledge content..."
                      value={newKnowledge.content}
                      onChange={(e) => setNewKnowledge(prev => ({ ...prev, content: e.target.value }))}
                      rows={6}
                    />
                  </div>
                  <Button 
                    onClick={() => addKnowledgeMutation.mutate(newKnowledge)}
                    disabled={addKnowledgeMutation.isPending || !newKnowledge.title || !newKnowledge.content}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {addKnowledgeMutation.isPending ? "Adding..." : "Add Knowledge"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Base Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {knowledgeBase?.map((item: KnowledgeBase) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{item.title}</h4>
                            <Badge variant="outline">{item.type}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.content.length > 100 ? `${item.content.substring(0, 100)}...` : item.content}
                          </p>
                          {item.sourceUrl && (
                            <p className="text-xs text-blue-600 mt-1">{item.sourceUrl}</p>
                          )}
                        </div>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Merchant Feeds Tab */}
          <TabsContent value="merchant">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add Merchant Feed</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="feedName">Feed Name</Label>
                    <Input
                      id="feedName"
                      placeholder="Google Shopping Feed"
                      value={newFeed.name}
                      onChange={(e) => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="feedUrl">Feed URL</Label>
                    <Input
                      id="feedUrl"
                      placeholder="https://example.com/products.xml"
                      value={newFeed.feedUrl}
                      onChange={(e) => setNewFeed(prev => ({ ...prev, feedUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="syncInterval">Sync Interval (seconds)</Label>
                    <Input
                      id="syncInterval"
                      type="number"
                      placeholder="10800"
                      value={newFeed.syncInterval}
                      onChange={(e) => setNewFeed(prev => ({ ...prev, syncInterval: parseInt(e.target.value) }))}
                    />
                    <p className="text-sm text-gray-600 mt-1">Default: 10800 seconds (3 hours)</p>
                  </div>
                  <Button 
                    onClick={() => addMerchantFeedMutation.mutate(newFeed)}
                    disabled={addMerchantFeedMutation.isPending || !newFeed.name || !newFeed.feedUrl}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {addMerchantFeedMutation.isPending ? "Adding..." : "Add Feed"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Merchant Feeds
                    <Button
                      onClick={() => syncFeedsMutation.mutate()}
                      disabled={syncFeedsMutation.isPending}
                      size="sm"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${syncFeedsMutation.isPending ? 'animate-spin' : ''}`} />
                      {syncFeedsMutation.isPending ? "Syncing..." : "Sync Now"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {merchantFeeds?.map((feed: MerchantFeed) => (
                      <div key={feed.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{feed.name}</h4>
                            <Badge variant={feed.isActive ? "default" : "secondary"}>
                              {feed.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{feed.feedUrl}</p>
                          {feed.lastSyncedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              Last synced: {new Date(feed.lastSyncedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Upload Content Tab */}
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">Upload PDFs, documents, or other content to expand the knowledge base.</p>
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
                  <p className="text-sm text-gray-500">Supported formats: PDF, TXT, DOCX, MD</p>
                  <Button variant="outline" className="mt-4">
                    Choose Files
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}