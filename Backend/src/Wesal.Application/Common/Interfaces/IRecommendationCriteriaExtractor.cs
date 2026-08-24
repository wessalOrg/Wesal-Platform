using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IRecommendationCriteriaExtractor
{
    ExtractedCriteriaDto Extract(string message);
}
